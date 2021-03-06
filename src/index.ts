#!/usr/bin/env node
import * as net from "node:net";
import yargs from "yargs";

const cmdOptions = yargs(process.argv.slice(2)).alias("h", "help").alias("v", "version").wrap(yargs.terminalWidth()).option("port", {
  type: "number",
  default: !!process.env.PORT_LISTEN ? parseInt(process.env.PORT_LISTEN) : 8080,
  alias: "p",
  description: "Port to listen server"
}).option("ssh", {
  type: "string",
  default: process.env.SSH_HOST||"0.0.0.0:22",
  alias: "s",
  description: "SSH host and port"
}).option("code", {
  type: "number",
  default: 101,
  alias: "c",
  description: "Proxy HTTP status code"
}).option("message", {
  type: "string",
  default: process.env.STATUS_MESSAGE||"<font color=\"green\">By OFVp Project</font>",
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
  default: process.env.LOG_LEVEL||"LOG1",
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

const portListen = cmdOptions.port,
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

type payload = {
  raw?: string,
  method: string,
  httpVersion: string,
  path: string,
  header: {[key: string]: string},
  second?: payload
}
function parsePayload(data: string): payload {
  const connectionPayload: payload = {
    raw: data,
    method: "",
    httpVersion: "",
    path: "",
    header: {}
  }
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
      if (!connectionPayload.second) connectionPayload["second"] = {method: "", httpVersion: "", path: "", header: {}};
      if (!connectionPayload.second.method) connectionPayload.header[key.trim()] = value.trim();
      else connectionPayload.second.header[key.trim()] = value.trim();
    }
  };
  // let hostPort = connectionPayload.header["X-Real-Host"]||connectionPayload.second?.header["X-Real-Host"]||"";
  // if (hostPort.includes(":")) {
  //   sshHost = hostPort.split(":")[0];
  //   sshPort = parseInt(hostPort.split(":")[1]);
  // }

  // if (connectionPayload.second?.method === "CONNECT") {
  //   if (allowReplaceHostByHeader) {
  //     const [host, port] = connectionPayload.second?.path.split(":");
  //     if (!!host) sshHost = host;
  //     if (!!port) sshPort = parseInt(port)||80;
  //   }
  // } else if (connectionPayload.method === "CONNECT") {
  //   if (allowReplaceHostByHeader) {
  //     const [host, port] = connectionPayload.path.split(":");
  //     if (!!host) sshHost = host;
  //     if (!!port)sshPort = parseInt(port)||80;
  //   }
  // }
  return connectionPayload;
}
parsePayload("")
async function connectionHandler(client: net.Socket, sshHost: string, sshPort: number) {
  let clientIpPort = client.remoteAddress+":"+client.remotePort;
  if (logLevel !== "NONE") console.log("[Client: %s]: Connected", clientIpPort);
  client.once("close", () => logLevel !== "NONE" ? console.log("[Client: %s]: Close connection", clientIpPort) : null);
  const data = await new Promise<string>(resolve => client.once("data", (data) => resolve(data.toString())));
  // const connectionPayload = parsePayload(data);
  // if (logLevel === "DEBUG1") console.log("[Client: %s]: Payload Recived:\n%o", clientIpPort, connectionPayload);
  if (logLevel === "DEBUG1") console.log("[Client: %s]: Payload Recived:\n%o", clientIpPort, data);
  client.write(`HTTP/${httpVersion} ${httpCode} ${httpMessage}\r\n\r\n`);
  const target = net.createConnection({port: sshPort, host: sshHost});
  target.pipe(client); client.pipe(target);
  target.on("error", err => console.log("[Target]: %s", String(err))); client.on("error", err => console.log("[Target]: %s", String(err)));
  target.once("close", () => client.end()); client.once("close", () => target.end());
  return new Promise<boolean>(resolve => {
    client.once("close", resolve);
    target.once("close", resolve);
  });
}

// Create TCP socket server
const serverListen = net.createServer();
serverListen.setMaxListeners(0);
serverListen.listen(portListen, "0.0.0.0", () => console.log("wsSSH: web proxy listen on port %d\n****** LOG ******\n", portListen));
serverListen.on("connection", (connection) => connectionHandler(connection, ssh.host, ssh.port).catch(console.trace));
