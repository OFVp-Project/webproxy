import { createServer } from "net";
import { randomUUID } from "crypto";
import yargs from "yargs";
import { connectionHandler } from "./handler";

const cmdOptions = yargs(process.argv.slice(2)).alias("h", "help").option("port", {type: "number",
  default: 80,
  alias: "p",
  description: "Port to listen on"
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
  default: "<font color=\"null\">By ofvp project</font>",
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
  choices: ["LOG1", "DEBUG1", "NONE"]
}).help().parseSync();

const portListen = cmdOptions.port, httpCode = cmdOptions.code, httpMessage = cmdOptions.message, httpVersion = cmdOptions.httpVersion as "1.1"|"1.0", logLevel = cmdOptions.loglevel.toUpperCase() as "LOG1"|"DEBUG1"|"NONE", ssh = {host: cmdOptions.ssh.split(":")[0], port: parseInt(cmdOptions.ssh.split(":")[1])};
console.log("wsSSH: Starting web proxy on port %d", portListen)
console.log("wsSSH: SSH host: %s", cmdOptions.ssh)
console.log("wsSSH: HTTP status code: %d", httpCode)
console.log("wsSSH: HTTP status message: %s", httpMessage)
console.log("wsSSH: HTTP version: HTTP/%s", httpVersion)
console.log("wsSSH: log Leve %s", logLevel)
console.log("wsSSH: Starting web proxy...\n****** LOG ******\n")

// Sessions and stop connections on sigint
const Sessions: {[key: string]: connectionHandler} = {};
process.on("SIGINT", async () => {
  console.log("\nClosing all connections...");
  for (const session of Object.keys(Sessions)) {
    Sessions[session].closeClient("Server is shutting down", 503);
  }
  console.log("Closing server...");
  process.exit(0);
});

// Create TCP socket server
const serverListen = createServer();
serverListen.setMaxListeners(0);
serverListen.listen(portListen, "0.0.0.0", () => console.log("wsSSH: Starting web proxy on port %d", portListen));

// Handle new connections
serverListen.on("connection", (connection) => {
  if (logLevel !== "NONE") console.log("wsSSH: Client connected: %s", connection.remoteAddress+":"+connection.remotePort);
  connection.allowHalfOpen = true;
  connection.setNoDelay(true);
  connection.setKeepAlive(true);
  const Connection = new connectionHandler(connection, ssh.host, ssh.port, httpCode, httpMessage, httpVersion, logLevel);
  const id = randomUUID();
  Sessions[id] = Connection;
  Connection.main();
  connection.once("close", () => {
    if (!!Sessions[id]) delete Sessions[id];
    if (logLevel !== "NONE") console.log("wsSSH: Client disconnected: %s", connection.remoteAddress+":"+connection.remotePort);
  });
});