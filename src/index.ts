#!/usr/bin/env node
import { createServer } from "net";
import { randomUUID } from "crypto";
import yargs from "yargs";
import { connectionHandler } from "./handler";

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
  default: 200,
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
allowReplaceHost = cmdOptions.allowReplaceHost;
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
console.log("wsSSH:", allowReplaceHost?"allow replace host by header":"not allow replace host by header");
console.log("wsSSH: Listen on %d", portListen);
console.log("wsSSH: Starting web proxy...")

// Sessions and stop connections on sigint
const Sessions: {[key: string]: connectionHandler} = {};
process.on("SIGINT", async () => {
  console.log("\nClosing all connections...");
  for (const session of Object.keys(Sessions)) {
    if (!Sessions[session].closed) {
      Sessions[session].closeClient("Server is shutting down", 503);
      console.log("Closed connection: %s", Sessions[session].clientIpre);
    }
  }
  console.log("Closing server...");
  process.exit(0);
});

// Create TCP socket server
const serverListen = createServer();
serverListen.setMaxListeners(0);
serverListen.listen(portListen, "0.0.0.0", () => console.log("wsSSH: web proxy listen on port %d\n****** LOG ******\n", portListen));

// Handle new connections
serverListen.on("connection", (connection) => {
  connection.allowHalfOpen = true;
  connection.setNoDelay(true);
  connection.setKeepAlive(true);
  const Connection = new connectionHandler(connection, ssh.host, ssh.port, httpCode, httpMessage, httpVersion, logLevel, allowReplaceHost);
  const id = randomUUID();
  Sessions[id] = Connection;
  Connection.main();
  connection.once("close", () => {if (!!Sessions[id]) delete Sessions[id];});
});