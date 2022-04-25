import yargs from "yargs";
import Server from "./Server";

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
}).option("buffer", {
  type: "number",
  default: 1024,
  alias: "b",
  description: "Buffer size for socket"
}).help().parseSync();

console.log("wsSSH: Starting web proxy on port %d", cmdOptions.port)
console.log("wsSSH: SSH host: %s", cmdOptions.ssh)
console.log("wsSSH: HTTP status code: %d", cmdOptions.code)
console.log("wsSSH: HTTP status message: %s", cmdOptions.message)
console.log("wsSSH: HTTP version: HTTP/%s", cmdOptions.httpVersion)
console.log("wsSSH: Starting web proxy...\n****** LOG ******\n")
const ServerConfig = new Server(cmdOptions.port, cmdOptions.ssh, cmdOptions.code, cmdOptions.message, cmdOptions.httpVersion as any, cmdOptions.buffer);
ServerConfig.startServer();