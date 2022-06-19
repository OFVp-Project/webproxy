#!/usr/bin/env node
import * as net from "node:net";
import yargs from "yargs";

const cmdOptions = yargs(process.argv.slice(2)).alias("h", "help").alias("v", "version").wrap(yargs.terminalWidth()).option("port", {type: "number",
  default: 80,
  alias: "p",
  description: "Port to listen server"
}).option("ssh", {
  type: "string",
  default: "0.0.0.0:22",
  alias: "s",
  description: "SSH host and port"
}).option("code", {
  type: "number",
  default: 101,
  alias: "c",
  description: "Proxy HTTP status code"
}).option("message", {
  type: "string",
  default: "<font color=\"green\">By OFVp Project</font>",
  alias: "m",
  description: "Proxy HTTP status message"
}).option("httpVersion", {
  type: "string",
  default: "1.1",
  alias: "V",
  description: "HTTP version",
  choice: ["1.0", "1.1"]
}).option("loglevel", {
  type: "string",
  alias: "l",
  description: "Log level to show in console",
  default: "LOG1",
  choices: [
    "NONE",   "none",  "0",
    "LOG1",   "log",   "1",
    "DEBUG1", "debug", "2"
  ]
}).option("allowReplaceHost", {
  type: "boolean",
  default: false,
  alias: "r",
  description: "Allow to replace host if includes CONNECT in header"
}).help().parseSync();

const
portListen = cmdOptions.port,
httpCode = cmdOptions.code,
httpMessage = cmdOptions.message,
httpVersion = cmdOptions.httpVersion,
ssh = {host: cmdOptions.ssh.split(":")[0], port: parseInt(cmdOptions.ssh.split(":")[1])},
allowReplaceHostByHeader = cmdOptions.allowReplaceHost;
let logLevel: "LOG1"|"DEBUG1"|"NONE" = "LOG1";
if (cmdOptions.loglevel.toUpperCase() === "LOG1"||cmdOptions.loglevel.toUpperCase() === "LOG"||cmdOptions.loglevel.toUpperCase() === "1") logLevel = "LOG1";
else if (cmdOptions.loglevel.toUpperCase() === "DEBUG1"||cmdOptions.loglevel.toUpperCase() === "DEBUG"||cmdOptions.loglevel.toUpperCase() === "2") logLevel = "DEBUG1";
else if (cmdOptions.loglevel.toUpperCase() === "NONE"||cmdOptions.loglevel.toUpperCase() === "0") logLevel = "NONE";
else throw new Error("Unknown log level");

// Show options selected
console.log("wsSSH: log Leve %s", logLevel);
console.log("wsSSH: Default host connect: %s", cmdOptions.ssh);
console.log("wsSSH: HTTP status code: %d", httpCode);
console.log("wsSSH: HTTP status message: %s", httpMessage);
console.log("wsSSH: HTTP version: HTTP/%s", httpVersion);
console.log("wsSSH:", allowReplaceHostByHeader?"allow replace host by header":"not allow replace host by header");
console.log("wsSSH: Listen on %d", portListen);
console.log("wsSSH: Starting web proxy...")

async function connectionHandler(client: net.Socket, sshHost: string, sshPort: number) {
  let ClientClosed = false;
  let clientIpPort = client.remoteAddress+":"+client.remoteAddress;
  if (logLevel !== "NONE") console.log("[Client: %s]: Connected", clientIpPort);
  client.once("close", () => {
    if (logLevel !== "NONE") console.log("[Client: %s]: Close connection", clientIpPort);
    ClientClosed = true;
  });
  const connectionPayload: {raw: string, method: string, httpVersion: string, path: string, header: {[key: string]: string}, second?: {method: string, httpVersion: string, path: string, header: {[key: string]: string}}} = {
    second: {
      method: "",
      httpVersion: "",
      path: "",
      header: {},
    },
    method: "",
    httpVersion: "",
    path: "",
    header: {},
    raw: "",
  }

  /** Close client side */
  async function closeClient(msg?: string, code?: number) {
    if (!client?.destroyed) {
      if (code) {
        client.end(`HTTP/1.1 ${code} ${msg||"Bad Response"}\r\n\r\n`)
      } else client.end(msg?msg:undefined);
      client.destroy();
    }
    return;
  }

  /** Set target (SSH) connection */
  async function connect_target() {
    if (ClientClosed) throw new Error("Client Closed");
    const target = net.createConnection({port: sshPort, host: sshHost});
    target.once("ready", () => client.write(`HTTP/${httpVersion} ${httpCode} ${httpMessage}\r\n\r\n`));
    /**
     * After the client and target are connected, this function will transmit data between them
     */
    target.on("error", err => console.log("[Target]: %s", String(err)));
    client.on("error", err => console.log("[Target]: %s", String(err)));
    target.pipe(client).pipe(target);
    client.once("close", () => closeClient("Timeout", 400));
    target.once("close", () => closeClient("Timeout", 400));
    return new Promise<boolean>(resolve => {
      client.once("close", resolve);
      target.once("close", resolve);
    })
  }

  async function sendSwitchAndSendDatas() {
    // client.write(`HTTP/${httpVersion} ${httpCode} ${httpMessage}\r\n\r\n`);
    return connect_target();
  }

  const data = await new Promise<string>(resolve => {
    client.once("data", (data) => {
      resolve(data.toString());
    });
  });
  connectionPayload.raw = data;
  // Parse init Payload
  for (const line of data.replace(/\r/g, "").split("\n")) {
    if (/^GET|POST|CONNECT|HEAD|PUT|DELETE|OPTIONS|TRACE|PATCH|PROPFIND|PROPPATCH|MKCOL|COPY|MOVE|LOCK|UNLOCK|VERSION-CONTROL/.test(line)) {
      const dataPay = line.match(/^(.*)\s+(.*)\s+HTTP\/(.*)/);
      if (dataPay) {
        if (!connectionPayload.method) {
          connectionPayload.method = dataPay[1];
          connectionPayload.path = dataPay[2];
          connectionPayload.httpVersion = dataPay[3].trim();
        } else {
          connectionPayload.second.method = dataPay[1];
          connectionPayload.second.path = dataPay[2];
          connectionPayload.second.httpVersion = dataPay[3].trim();
        }
      }
    } else if (line.includes(":")) {
      const [key, value] = line.split(":");
      if (!connectionPayload.second.method) connectionPayload.header[key.trim()] = value.trim();
      else connectionPayload.second.header[key.trim()] = value.trim();
    }
  };
  let hostPort = connectionPayload.header["X-Real-Host"]||connectionPayload.second?.header["X-Real-Host"]||"";
  if (hostPort.includes(":")) {
    sshHost = hostPort.split(":")[0];
    sshPort = parseInt(hostPort.split(":")[1]);
  }

  if (connectionPayload.second?.method === "CONNECT") {
    if (allowReplaceHostByHeader) {
      const [host, port] = connectionPayload.second?.path.split(":");
      if (!!host) sshHost = host;
      if (!!port) sshPort = parseInt(port)||80;
    }
  } else if (connectionPayload.method === "CONNECT") {
    if (allowReplaceHostByHeader) {
      const [host, port] = connectionPayload.path.split(":");
      if (!!host) sshHost = host;
      if (!!port)sshPort = parseInt(port)||80;
    }
  }
  if (logLevel === "DEBUG1") console.log("[Client: %s]: Payload Recived:\n%o", clientIpPort, connectionPayload);
  return sendSwitchAndSendDatas();
}

// Create TCP socket server
const serverListen = net.createServer();
serverListen.setMaxListeners(0);
// Handle new connections
serverListen.on("connection", (connection) => {
  connection.allowHalfOpen = true;
  connection.setNoDelay(true);
  connection.setKeepAlive(true);
  return connectionHandler(connection, ssh.host, ssh.port).catch(console.trace);
});
// Listen Proxy
serverListen.listen(portListen, "0.0.0.0", () => console.log("wsSSH: web proxy listen on port %d\n****** LOG ******\n", portListen));
