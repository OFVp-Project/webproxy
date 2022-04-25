import net from "net";

async function slectWait(r: Array<net.Socket>, w: Array<net.Socket>) {
  await Promise.all([
    Promise.all(r.map(async (s) => {
      return new Promise(async (resolve) => {
        while (true) {
          if (s.readable) return resolve("");
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      });
    })),
    Promise.all(w.map(async (s) => {
      return new Promise(async (resolve) => {
        while (true) {
          if (s.writable) return resolve("");
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      });
    }))
  ])
}

export class connectionHandler {
  private client: net.Socket = undefined as any;
  public closed = false;
  private target?: net.Socket = undefined;
  private sshHost: string = "0.0.0.0"
  private sshPort: number = 22
  private BufferRec = 0
  private httpCode: number = 200
  private httpMessage: string = "OK"
  private httpVersion: "1.0"|"1.1" = "1.0"
  private Timeout: number = 60
  constructor (client: net.Socket, sshHost: string, sshPort: number, Timeout: number, httpCode: number, httpMessage: string, httpVersion: "1.0"|"1.1", BufferRec: number) {
    this.client = client
    this.sshHost = sshHost
    this.sshPort = sshPort
    this.BufferRec = BufferRec
    this.httpCode = httpCode
    this.httpMessage = httpMessage
    this.httpVersion = httpVersion
    this.Timeout = Timeout
    console.log(this.Timeout)
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

  /** Close connection */
  public async closeClient(msg?: string) {
    if (this.target !== undefined) {
      if (!this.target.destroyed) {
        this.target.end(msg?msg:undefined);
        this.target.destroy();
      }
    }
    if (!this.client.destroyed) {
      this.client.end(msg?msg:undefined);
      this.client.destroy();
    }
    return;
  }
  
  private findHeader(data: string, header: string): string | undefined {
    for (const line of data.split("\r\n")) {
      if (line.startsWith(header)) {
        return line.replace(header+":", "").trim();
      }
    }
    return undefined;
  }

  private method = "GET"
  private async connect_target(host: string) {
    if (!host) host = this.sshHost+":"+this.sshPort;
    const exits = host.includes(":");
    let port: number = this.sshPort;
    if (exits) {
      const [hostname, portI] = host.split(":");
      port = parseInt(portI);
      host = hostname;
      if (isNaN(port)) {
        console.log("wsSSH: Invalid port: %s", portI);
        return;
      }
    } else {
      if (this.method === "CONNECT") port = 443;
      else port = 80;
    }
    this.target = net.createConnection({port: port, host: host});
    this.closed = false;
    this.target.once("connect", () => {
      console.log("wsSSH: Connected to %s:%d", host, port);
    });
  }

  private async ClientConnectAndTransmit() {
    this.target.on("data", (data) => {
      this.client.write(data);
    });
    this.client.on("data", (data) => {
      this.target.write(data);
    });
  }

  private sendMenssage() {
    const MessageToSend = `HTTP/${this.httpVersion} ${this.httpCode} ${this.httpMessage}`
    this.client.write(`${MessageToSend}\r\n\r\n`);
  }

  private async ConnectMethod(hostPort: string) {
    this.sendMenssage();
    this.connect_target(hostPort);
    await slectWait([this.client], [this.target]);
    console.log("wsSSH: Connected to %s:%d", hostPort, this.sshPort);
    this.ClientConnectAndTransmit();
  }

  public async main() {
    const data = await new Promise<string>(resolve => {
      this.client.once("data", (data) => {
        resolve(data.toString());
      });
    });
    let hostPort = this.findHeader(data, "X-Real-Host")
    if (hostPort == "") hostPort = this.sshHost+":"+this.sshPort;
    
    let split = this.findHeader(data, "X-Split")
    if (split !== "") this.client.read(this.BufferRec)
    
    if (hostPort != "") {
      let PASS = ""
      let passwd = this.findHeader(data, "X-Pass")
      if (PASS.length !== 0 && passwd === PASS) this.ConnectMethod(hostPort)
      else if (PASS.length !== 0 && passwd !== PASS) this.client.write('HTTP/1.1 400 WrongPass!\r\n\r\n')
      this.ConnectMethod(hostPort)
    } else this.client.write('HTTP/1.1 400 NoXRealHost!\r\n\r\n')
  }
}
