import net from "net";

export class connectionHandler {
  private client: net.Socket = undefined as any;
  public closed = false;
  private httpCode: number = 101
  private httpMessage: string = "<font color=\"null\">By ofvp project</font>"
  private sshHost: string = "0.0.0.0:22"
  private Timeout: number = 60
  private httpVersion: "1.0"|"1.1" = "1.1"
  private BufferCreate: number = 1024
  private haders: {[key: string]: string} = {};
  constructor (client: net.Socket, sshHost: string, Timeout: number, httpCode: number, httpMessage: string, httpVersion: "1.0"|"1.1", BufferCreate: number) {
    this.client = client
    this.sshHost = sshHost
    this.Timeout = Timeout
    this.httpCode = httpCode
    this.httpMessage = httpMessage
    this.httpVersion = httpVersion
    this.BufferCreate = BufferCreate
    this.client.once("close", () => {
      console.log("wsSSH: Client disconnected: %s", this.client.remoteAddress+":"+this.client.remotePort);
      this.closed = true;
    });
    this.client.once("error", () => {
      if (!this.closed) {
        console.log("wsSSH: Client disconnected: %s", this.client.remoteAddress+":"+this.client.remotePort);
        return
      }
      this.closed = true;
    });
  }

  /** Send custom message */
  public async main() {
    if (this.closed) return
    await this.runFist();
    this.client.write(`HTTP/${this.httpVersion} ${this.httpCode} ${this.httpMessage}\r\n\r\n`);
    return;
  }

  /** Close connection */
  public async closeClient() {
    if (this.closed) return
    this.client.destroy(new Error("wsSSH: server closed connection"));
    return;
  }

  private createSSHProxy() {
    const sshDial = net.createConnection(parseInt(this.sshHost.split(":")[1]), this.sshHost.split(":")[0]);
    sshDial.on("data", data => console.log("ssh: %s", data.toString()));
    // sshDial.write("SSH-2.0-OpenSSH_8.4p1 Debian-5\r\n");
    this.client.on("close", () => sshDial.destroy());
    sshDial.on("connect", () => {
      console.log("wsSSH: SSH connection established: %s", this.sshHost);
      sshDial.on("close", () => this.client.destroy());
    });
  }

  /** run Conenction */
  public async runFist() {
    if (this.closed) return
    await new Promise(res => {
      this.client.once("data", (data) => {
        const str = data.toString();
        const headers = str.split("\r\n").filter(line => line.length > 0);
        for (const header_line of headers) {
          if (header_line.length === 0) continue;
          if (header_line.includes(":")) {
            const [key, value] = header_line.split(":");
            this.haders[key.trim()] = value.trim();
          }
        }
        console.log("wsSSH: Client headers: %o", this.haders);
        console.log("wsSSH: Client raw headers: %s", str);
        res("");
      });
    });
    this.createSSHProxy();
  }
}
