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
  private httpVersion: string = "1.0";
  public clientIpre = "";
  private allowReplaceHostByHeader: true|false = false;
  private connectionPayload: {raw: string, method: string, httpVersion: string, path: string, header: {[key: string]: string}, second?: {method: string, httpVersion: string, path: string, header: {[key: string]: string}}} = {
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
  constructor (client: net.Socket, sshHost: string, sshPort: number, httpCode: number, httpMessage: string, httpVersion: string, logLevel: "LOG1"|"DEBUG1"|"NONE", allowReplaceHostByHeader: true|false) {
    this.client = client
    this.sshHost = sshHost
    this.sshPort = sshPort
    this.logLevel = logLevel
    this.httpCode = httpCode
    this.httpMessage = httpMessage
    this.httpVersion = httpVersion
    this.clientIpre = `${this.client.remoteAddress}:${this.client.remotePort}`;
    this.allowReplaceHostByHeader = allowReplaceHostByHeader
    
    // Connection log
    if (this.logLevel !== "NONE") console.log("%s wsSSH (Client): Connected", this.clientIpre);
    this.client.once("close", () => {if (this.logLevel !== "NONE") console.log("%s wsSSH (Client): disconnected", this.clientIpre)});
    this.client.once("error", err => {
      if (!this.closed) {
        if (this.logLevel !== "NONE") console.log("%s wsSSH (Client): error: %s", this.clientIpre, err.message);
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

  /** Set target (SSH) connection */
  private connect_target() {
    this.target = net.createConnection({port: this.sshPort, host: this.sshHost});
    this.closed = false;
    this.target.once("connect", () => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Connected to %s:%d", this.clientIpre, this.sshHost, this.sshPort);
    });
    this.target.once("error", (err) => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Error connecting to %s:%d: %s", this.clientIpre, this.sshHost, this.sshPort, err.message);
      this.closeClient();
    });
    this.target.once("close", () => {
      if (this.logLevel !== "NONE") console.log("%s wsSSH (SSH): Disconnected from %s:%d", this.clientIpre, this.sshHost, this.sshPort);
      this.closeClient();
    });
  }

  /**
   * After the client and target are connected, this function will transmit data between them
   */
  private async ClientConnectAndTransmit() {
    this.client.on("data", data => {
      if (this.closed) return;
      this.target.write(data);
    });
    
    this.target.on("data", data => {
      if (this.closed) return;
      this.client.write(data);
    })

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

  private async ConnectMethod() {
    this.sendMenssage();
    this.connect_target();
    await slectWait([this.client], [this.target]);
    this.ClientConnectAndTransmit();
  }

  public async main() {
    const data = await new Promise<string>(resolve => {
      this.client.once("data", (data) => {
        resolve(data.toString());
      });
    });
    this.connectionPayload.raw = data;
    // Parse init Payload
    for (const line of data.replace(/\r/g, "").split("\n")) {
      if (/^GET|POST|CONNECT|HEAD|PUT|DELETE|OPTIONS|TRACE|PATCH|PROPFIND|PROPPATCH|MKCOL|COPY|MOVE|LOCK|UNLOCK|VERSION-CONTROL/.test(line)) {
        const dataPay = line.match(/^(.*)\s+(.*)\s+HTTP\/(.*)/);
        if (dataPay) {
          if (!this.connectionPayload.method) {
            this.connectionPayload.method = dataPay[1];
            this.connectionPayload.path = dataPay[2];
            this.connectionPayload.httpVersion = dataPay[3].trim();
          } else {
            this.connectionPayload.second.method = dataPay[1];
            this.connectionPayload.second.path = dataPay[2];
            this.connectionPayload.second.httpVersion = dataPay[3].trim();
          }
        }
      } else if (line.includes(":")) {
        const [key, value] = line.split(":");
        if (!this.connectionPayload.second.method) this.connectionPayload.header[key.trim()] = value.trim();
        else this.connectionPayload.second.header[key.trim()] = value.trim();
      }
    };
    if (this.logLevel === "DEBUG1") console.log("%s wsSSH: parsed headers:\n%o", this.clientIpre, this.connectionPayload);
    let hostPort = this.connectionPayload.header["X-Real-Host"]||this.connectionPayload.second?.header["X-Real-Host"]||"";
    if (hostPort.includes(":")) {
      this.sshHost = hostPort.split(":")[0];
      this.sshPort = parseInt(hostPort.split(":")[1]);
    }
    
    if (/<\?=md5("phpunit")\?>/.test(data)) {
      this.client.write(`HTTP/1.1 60000 CVE-2017-9841\r\n\r\n`);
      this.client.end("It's trying to use CVE-2017-9841 but unable to use PHPUnit because PHPUnit is not compatible with Nodejs, By OFVp Project, https://github.com/OFVp-Project/webproxy/tree/src/handler.ts#L1630\n");
      return;
    }

    if (this.connectionPayload.second?.method === "CONNECT") {
      if (this.allowReplaceHostByHeader) {
        const [host, port] = this.connectionPayload.second?.path.split(":");
        if (!!host) this.sshHost = host;
        if (!!port)this.sshPort = parseInt(port)||80;
        console.log("%s wsSSH (Client): Replaced host to %s:%d", this.clientIpre, this.sshHost, this.sshPort);
      }
      this.ConnectMethod();
    } else if (this.connectionPayload.method === "CONNECT") {
      if (this.allowReplaceHostByHeader) {
        const [host, port] = this.connectionPayload.path.split(":");
        if (!!host) this.sshHost = host;
        if (!!port)this.sshPort = parseInt(port)||80;
        console.log("%s wsSSH (Client): Replaced host to %s:%d", this.clientIpre, this.sshHost, this.sshPort);
      }
      this.ConnectMethod();
    } else this.ConnectMethod()
  }
}
