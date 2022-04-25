import { createServer, Server } from "net";
import { Socket } from "net";
import { connectionHandler } from "./handler";

export default class serverListen {
  private portListen: number = 80
  private serverListen?: Server
  private clients: Array<{connection: connectionHandler, socket: Socket}> = []
  private sshHost: string = "0.0.0.0:22"
  private httpCode: number = 101
  private httpMessage: string = "<font color=\"null\">By ofvp project</font>"
  private httpVersion: "1.0"|"1.1" = "1.1"
  private BufferCreate: number = 1024
  constructor(Port: number, SSH: string, Code: number, Message: string, HTTP_Version: "1.0"|"1.1", Client_Buffer: number) {
    this.portListen = Port
    this.sshHost = SSH
    this.httpCode = Code
    this.httpMessage = Message
    this.httpVersion = HTTP_Version
    this.BufferCreate = Client_Buffer
  }
  
  /** Listen simple HTTP server */
  public startServer() {
    this.serverListen = createServer();
    this.serverListen.listen(this.portListen, "0.0.0.0", () => console.log("wsSSH: Starting web proxy on port %d", this.portListen));
    this.serverListen.on("connection", (socket) => {
      console.log("wsSSH: Client connected: %s", socket.remoteAddress+":"+socket.remotePort);
      socket.allowHalfOpen = true;
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
      const Connection = new connectionHandler(socket, this.sshHost.split(":")[0], parseInt(this.sshHost.split(":")[1]), this.httpCode, this.httpMessage, this.httpVersion, this.BufferCreate);
      Connection.main();
      this.clients.push({
        connection: Connection,
        socket: socket
      });
    });
  }
}