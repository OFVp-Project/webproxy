from select import select
from socket import getaddrinfo, socket, timeout
import sys
import threading
import re

class ConnectionHandler(threading.Thread):
  def __init__(self, socClient, server, addr, SSH):
    threading.Thread.__init__(self)
    self.clientClosed = False
    self.targetClosed = True
    self.client = socClient
    self.clientbuffer = ""
    self.server = server
    self.addr = addr
    self.DEFAULT_HOST = SSH
    self.timeout = self.server.Timeout
    print(addr[0]+":"+str(addr[1])+": New connection")

  def closeClient(self):
    try:
      if not self.clientClosed:
        self.client.shutdown(SHUT_RDWR)
        self.client.close()
    except:
      pass
    finally:
      self.clientClosed = True
    
    try:
      if not self.targetClosed:
        self.target.shutdown(SHUT_RDWR)
        self.target.close()
    except:
      pass
    finally:
      self.targetClosed = True
    try:
      if not self.targetClosed:
        self.target.close()
    except:
      pass
    finally:
      self.targetClosed = True

  def ConnectMethod(self, path):
    self.connect_target(str(path))
    Menssage_to_send = str(self.server.HTTP_Version) + " " + str(self.server.Code) + " " + str(self.server.Message) + "\r\n\r\n"
    self.client.sendall(bytes(Menssage_to_send, "utf8"))
    self.clientbuffer = ""
    self.ClientConnectAndTransmit()

  def run(self):
    try:
      dc = self.client.recv(self.server.Client_Buffer).decode()
      self.clientbuffer = dc.split("\r\n")
      
      # Detect agent is curl or wget and return 200 ok
      match = re.match(r'((?P<agent>[^"]*?))/', self.findHeader(self.clientbuffer, "User-Agent"))
      agent = match and match.groupdict()["agent"] or ""
      if (agent == "curl" or agent == "wget"):
        self.client.send(bytes("HTTP/1.1 200 OK\r\n\r\n", "utf8"))
        self.client.send(bytes("Running\n", "utf8"))
        self.client.close()
        print(self.addr[0]+":"+str(self.addr[1])+": Closing connection, wget or curl")
        return

      hostPort = self.findHeader(self.clientbuffer, "X-Real-Host")
      if hostPort == "":
        hostPort = self.DEFAULT_HOST
      
      split = self.findHeader(self.clientbuffer, "X-Split")
      if split != "":
        self.client.recv(self.server.Client_Buffer)
      
      if hostPort != "":
        PASS = ""
        passwd = self.findHeader(self.clientbuffer, "X-Pass")
        if len(PASS) != 0 and passwd == PASS:
          self.ConnectMethod(hostPort)
        elif len(PASS) != 0 and passwd != PASS:
          self.client.send('HTTP/1.1 400 WrongPass!\r\n\r\n')
        self.ConnectMethod(hostPort)
      else:
        print('- No X-Real-Host!')
        self.client.send('HTTP/1.1 400 NoXRealHost!\r\n\r\n')
    except Exception as e:
      print(self.addr[0]+":"+str(self.addr[1])+": Connection error: "+str(e))
    finally:
      try:
        self.closeClient()
        self.server.RemoveConn(self)
      except:
        print("Detected error, exit with code 1")
        sys.exit("Detected error")
  
  def findHeader(self, head, header):
    for line in head:
      if line.find(header) != -1:
        return line.replace(header + ": ", "")
    return ""
  
  def connect_target(self, host):
    i = host.find(":")
    if i != -1:
      port = int(host[i+1:])
      host = host[:i]
    else:
      print("- Error no port in X-Real-Host: " + host)
      if self.method == "CONNECT":
        port = 443
      else:
        port = 80
    (soc_family, soc_type, proto, _, address) = getaddrinfo(host, port)[0]
    self.target = socket(soc_family, soc_type, proto)
    self.targetClosed = False
    self.target.connect(address)

  def ClientConnectAndTransmit(self):
    socs = [self.client, self.target]
    count = 0
    error = False
    while True:
      count += 1
      (recv, _, err) = select(socs, [], socs, 3)
      if err:
        error = True
      if recv:
        for in_ in recv:
          try:
            data = in_.recv(self.server.Client_Buffer)
            if data:
              if in_ is self.target:
                self.client.send(data)
              else:
                while data:
                  byte = self.target.send(data)
                  data = data[byte:]
              count = 0
            else:
              break
          except:
            error = True
            break
      if count == self.timeout:
        error = True
      if error:
        print(self.addr[0]+":"+str(self.addr[1])+": Closing connection")
        break
    self.targetClosed = True
    self.clientClosed = True
    self.client.close()
    self.target.close()