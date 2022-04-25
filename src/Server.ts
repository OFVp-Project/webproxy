import { createServer, Server } from "http";
import { Socket } from "net";
import { connectionHandler } from "./handler";

export default class serverListen {
  private portListen: number = 80
  private serverListen: Server = undefined as any
  private clients: Array<{connection: connectionHandler, socket: Socket}> = []
  private sshHost: string = "0.0.0.0:22"
  private Timeout: number = 60
  private httpCode: number = 101
  private httpMessage: string = "<font color=\"null\">By ofvp project</font>"
  private httpVersion: "1.0"|"1.1" = "1.1"
  private BufferCreate: number = 1024
  constructor(Port: number, SSH: string, Timeout: number, Code: number, Message: string, HTTP_Version: "1.0"|"1.1", Client_Buffer: number) {
    this.portListen = Port
    this.sshHost = SSH
    this.Timeout = Timeout
    this.httpCode = Code
    this.httpMessage = Message
    this.httpVersion = HTTP_Version
    this.BufferCreate = Client_Buffer
  }
  
  /**
   * Listen simple HTTP server
   */
  public startServer() {
    this.serverListen = createServer();
    this.serverListen.listen(this.portListen, "0.0.0.0", () => console.log("wsSSH: Starting web proxy on port %d", this.portListen));
    this.serverListen.on("connection", (socket) => {
      console.log("wsSSH: Client connected: %s", socket.remoteAddress+":"+socket.remotePort);
      const Connection = new connectionHandler(socket, this.sshHost, this.Timeout, this.httpCode, this.httpMessage, this.httpVersion, this.BufferCreate);
      Connection.main();
      this.clients.push({
        connection: Connection,
        socket: socket
      });
    });
  }

  public async stopServer() {
    for (const client of this.clients) {
      try {
        await client.connection.closeClient()
      } catch (err) {
        console.log("wsSSH: Error on close client (%s): %s", client.socket.remoteAddress+":"+client.socket.remotePort, String(err))
      }
    }
  }
}