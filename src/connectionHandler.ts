import net from "net";

export class connectionHandler {
  private clientClosed = false
  private targetClosed = true
  private client: net.Socket
  private clientbuffer: string
  private server: net.Socket
  private addr: string
  private DEFAULT_HOST: string = "0.0.0.0:22"
  private timeout: number = 50
  constructor(socClient: net.Socket, server: net.Socket, addr: string, SSH: string, Timeout: number) {
    this.clientClosed = false
    this.targetClosed = true
    this.client = socClient
    this.clientbuffer = ""
    this.server = server
    this.addr = addr
    this.DEFAULT_HOST = SSH
    this.timeout = Timeout
    console.info("connectionHandler", this.addr, this.timeout)
  }
  public closeClient(): void {
    try {
      if (!this.clientClosed) {
        this.client.shutdown(SHUT_RDWR);
        this.client.close();
      }
    } catch (e) { }
    finally {
      this.clientClosed = true;
    }

    try {
      if (!this.targetClosed) {
        this.target.shutdown(SHUT_RDWR);
        this.target.close();
      }
    } catch (e) { }
    finally {
      this.targetClosed = true;
    }

    try {
      if (!this.targetClosed) {
        this.target.close();
      }
    } catch (e) { }
    finally {
      this.targetClosed = true;
    }
  }

  public ConnectMethod(this, path: string) {
    this.connect_target(path);
    const Menssage_to_send = `${this.server.HTTP_Version} ${this.server.Code} ${this.server.Message}\r\n\r\n`;
    this.client.sendall(Uint8Array.from(new TextEncoder().encode(Menssage_to_send)));
    this.clientbuffer = "";
    this.ClientConnectAndTransmit();
  }
  
  run(this: ClientHandler): void
  try:
    dc = this.client.recv(this.server.Client_Buffer).toString()
    this.clientbuffer = dc.split("\r\n")

    // Detect agent is curl or wget and return 200 ok
    const match = /^((?P<agent>[^"]*?))/.exec(this.findHeader(this.clientbuffer, "User-Agent"))
    const agent = match && match.groups()["agent"] || ""
    if (agent == "curl" || agent == "wget"):
      this.client.send(`HTTP/1.1 200 OK

      `)
      this.client.send(`Running
      `)
      this.client.close()
      console.log(this.addr[0]+":"+this.addr[1]+": Closing connection, wget or curl")
      return

    const hostPort = this.findHeader(this.clientbuffer, "X-Real-Host")
    if hostPort == "":
      hostPort = this.DEFAULT_HOST

    const split = this.findHeader(this.clientbuffer, "X-Split")
    if split != "":
      this.client.recv(this.server.Client_Buffer)

    if hostPort != "":
      const PASS = ""
      const passwd = this.findHeader(this.clientbuffer, "X-Pass")
      if (PASS.length != 0 && passwd == PASS):
        this.ConnectMethod(hostPort)
      else if (PASS.length != 0 && passwd != PASS):
        this.client.send("HTTP/1.1 400 WrongPass!\r\n\r\n")
      this.ConnectMethod(hostPort)
    else:
      console.log("- No X-Real-Host!")
      this.client.send("HTTP/1.1 400 NoXRealHost!\r\n\r\n")
  }
  catch (e) {
    console.log(this.addr[0]+":"+this.addr[1]+": Connection error: "+e+", Host:"+hostPort)
  }
  finally {
    try {
      this.closeClient()
      this.server.RemoveConn(this)
    }
    catch (e) {
      console.log(e)
    }
  }

  function findHeader(head: string[], header: string): string {
    for (const line of head) {
      if (line.indexOf(header) != -1) {
        return line.replace(header + ": ", "");
      }
    }
    return "";
  }

  connect_target(host: string): void {
    let i: number;
    i = host.indexOf(":");
    if (i != -1) {
      let port: number = parseInt(host.substr(i + 1));
      host = host.substr(0, i);
    } else {
      console.log("- Error no port in X-Real-Host: " + host);
      if (this.method == "CONNECT") {
        port = 443;
      } else {
        port = 80;
      }
    }
    let [soc_family, soc_type, proto, _, address] = getaddrinfo(host, port)[0];
    this.target = socket(soc_family, soc_type, proto);
    this.targetClosed = false;
    this.target.connect(address);
  }

  function ClientConnectAndTransmit():
    socs = [this.client, this.target]
    count = 0
    error = false;
    while true:
      count += 1
      (recv, _, err) = select(socs, [], socs, 3);
      if err:
        error = true;
      if recv:
        for in_ in recv:
          try:
            data = in_.recv(this.server.Client_Buffer);
            if data:
              if in_ is this.target:
                this.client.send(data);
              else:
                while data:
                  byte = this.target.send(data);
                  data = data[byte:];
              count = 0;
            else:
              break;
          except:
            error = true;
            break;
      if count == this.timeout:
        error = true;
      if error:
        console.log(this.addr[0]+":"+str(this.addr[1])+": Closing connection");
        break;
    this.targetClosed = true;
    this.clientClosed = true;
    this.client.close();
    this.target.close();
}