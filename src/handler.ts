import net from "net";

/**
 * Wait for connections make write and read
 * 
 * @param r - All sockets to wait readable
 * @param w - All sockets to wait writable
 */
async function slectWait(r: Array<net.Socket>, w: Array<net.Socket>) {
  await Promise.all([
    Promise.all(r.map(async (s) => {
      return new Promise((resolve) => {
        process.nextTick(async () => {
          while (true) {
            if (s.readable) return resolve("");
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        });
      });
    })),
    Promise.all(w.map((s) => {
      process.nextTick(async () => {
        new Promise(async (resolve) => {
          while (true) {
            if (s.writable) return resolve("");
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        });
      });
    }))
  ]);
}

export class connectionHandler {
  public closed = false;
  public target?: net.Socket = undefined;
  private client?: net.Socket = undefined;
  private sshHost: string = "0.0.0.0";
  private sshPort: number = 22;
  private logLevel: "LOG1"|"DEBUG1"|"NONE" = "LOG1";
  private httpCode: number = 200;
  private httpMessage: string = "OK";
  private httpVersion: "1.0"|"1.1" = "1.0";
  private clientIpre = "";
  constructor (client: net.Socket, sshHost: string, sshPort: number, httpCode: number, httpMessage: string, httpVersion: "1.0"|"1.1", logLevel: "LOG1"|"DEBUG1"|"NONE") {
    this.client = client
    this.sshHost = sshHost
    this.sshPort = sshPort
    this.logLevel = logLevel
    this.httpCode = httpCode
    this.httpMessage = httpMessage
    this.httpVersion = httpVersion
    this.clientIpre = `${this.client.remoteAddress}:${this.client.remotePort}`
    this.client.once("close", () => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH: Client disconnected", this.clientIpre);
      this.closed = true;
    });
    this.client.once("error", err => {
      if (!this.closed) {
        if (this.logLevel !== "NONE") console.log("%s wsSSH: Client error: %s", this.clientIpre, err.message);
        return
      }
      this.closed = true;
    });
  }

  /** Close connection */
  public async closeClient(msg?: string, code?: number) {
    if (this.target !== undefined) {
      if (!this.target.destroyed) {
        if (code) {
          this.target.end(`HTTP/1.1 ${code} ${msg||"Bad Response"}\r\n\r\n`)
        } else this.target.end(msg?msg:undefined);
        this.target.destroy();
      }
    }
    if (!this.client.destroyed) {
      if (code) {
        this.client.end(`HTTP/1.1 ${code} ${msg||"Bad Response"}\r\n\r\n`)
      } else this.client.end(msg?msg:undefined);
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

  private method = "GET";
  private async connect_target(host: string) {
    let port: number = this.sshPort;
    if (host === undefined) host = `${this.sshHost}:${this.sshPort}`;
    const exits = host.includes(":");
    if (exits) {
      const [hostname, portI] = host.split(":");
      port = parseInt(portI);
      host = hostname;
      if (isNaN(port)) {
        if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Invalid port: %s", this.clientIpre, portI);
        return;
      }
    } else {
      if (this.method === "CONNECT") port = 443;
      else port = 80;
    }
    if (/undefined/.test(host)) host = this.sshHost;
    this.target = net.createConnection({port: port, host: host});
    this.closed = false;
    this.target.once("connect", () => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Connected to %s:%d", this.clientIpre, host, port);
    });
    this.target.once("error", (err) => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Error connecting to %s:%d: %s", this.clientIpre, host, port, err.message);
      this.closeClient();
    });
  }

  /**
   * After the client and target are connected, this function will transmit data between them
   */
  private async ClientConnectAndTransmit() {
    this.client.pipe(this.target);
    this.target.pipe(this.client);
    await new Promise((resolve) => {
      this.client.once("close", resolve);
      this.target.once("close", resolve);
    });
    this.closeClient("Timeout", 400);
  }

  private sendMenssage() {
    const MessageToSend = `HTTP/${this.httpVersion} ${this.httpCode} ${this.httpMessage}`
    this.client.write(`${MessageToSend}\r\n\r\n`);
  }

  private async ConnectMethod(hostPort?: string) {
    if (hostPort === undefined) hostPort = `${this.sshHost}:${this.sshPort}`;
    else if (/undefined/.test(hostPort)) hostPort = `${this.sshHost}:${this.sshPort}`;
    this.sendMenssage();
    this.connect_target(hostPort);
    await slectWait([this.client], [this.target]);
    this.ClientConnectAndTransmit();
  }

  public async main() {
    const data = await new Promise<string>(resolve => {
      this.client.once("data", (data) => {
        resolve(data.toString());
      });
    });
    if (this.logLevel === "DEBUG1") console.log("%s wsSSH: Received data: %s", this.clientIpre, data);
    let hostPort = this.findHeader(data, "X-Real-Host")
    if (!hostPort) hostPort = this.sshHost+":"+this.sshPort;
    
    // const UserAgent = this.findHeader(data, "User-Agent")||"";
    // if (/curl|wget/.test(UserAgent.toLowerCase())) {
    //   this.client.write(`HTTP/1.1 200 OK\r\n\r\n`);
    //   this.client.end("Agent not allowed");
    //   return;
    // }

    let split = this.findHeader(data, "X-Split")
    if (!split) {}
    
    if (hostPort !== "") {
      let PASS = ""
      let passwd = this.findHeader(data, "X-Pass")
      if (PASS.length !== 0 && passwd === PASS) this.ConnectMethod(hostPort)
      else if (PASS.length !== 0 && passwd !== PASS) this.client.write('HTTP/1.1 400 WrongPass!\r\n\r\n')
      this.ConnectMethod(hostPort)
    } else this.client.write('HTTP/1.1 400 NoXRealHost!\r\n\r\n')
  }
}
