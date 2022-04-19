#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# All custom HTTP web proxy by Sirherobrine23 (mod)
# MIT License (c) 2021 Sirherobrine23 and the OFVp-Project Project
# Copyright reserved to Sirherobrine23 and the OFVp-Project Project
from argparse import ArgumentParser
from select import select
from socket import AF_INET, SHUT_RDWR, SO_REUSEADDR, getaddrinfo, socket, timeout
from ssl import SOL_SOCKET
import sys
import threading

class Server(threading.Thread):
  def __init__(self, Port, SSH, Timeout, Code, Message, HTTP_Version, Client_Buffer):
    threading.Thread.__init__(self)
    self.Running = False
    self.threads = []
    self.Port = Port
    self.SSH = SSH
    self.Timeout = Timeout
    self.Code = Code
    self.Message = Message
    self.HTTP_Version = HTTP_Version
    self.Client_Buffer = Client_Buffer
    self.threadsLock = threading.Lock()
    self.logLock = threading.Lock()
  def close(self):
    try:
      if not self.clientClosed:
        self.client.shutdown(socket.SHUT_RDWR)
        self.client.close()
    except:
      pass
    finally:
      self.clientClosed = True
    try:
      if not self.targetClosed:
        self.target.shutdown(socket.SHUT_RDWR)
        self.target.close()
    except:
      pass
    finally:
      self.targetClosed = True
  def run(self):
    self.soc = socket(AF_INET)
    self.soc.setsockopt(SOL_SOCKET, SO_REUSEADDR, 1)
    self.soc.settimeout(2)
    self.soc.bind(("0.0.0.0", self.Port))
    self.soc.listen(0)
    self.Running = True
    # Start the server
    try:
      while self.Running:
        try:
          c, addr = self.soc.accept()
          c.setblocking(1)
        except timeout:
          continue
        conn = ConnectionHandler(c, self, addr, self.SSH)
        conn.start()
        self.AddConn(conn)
    finally:
      self.Running = False
      self.soc.close()
  def printLog(self, log):
    self.logLock.acquire()
    print(log)
    self.logLock.release()
  def AddConn(self, conn):
    try:
      self.threadsLock.acquire()
      if self.Running:
        self.threads.append(conn)
    finally:
      self.threadsLock.release()
  def RemoveConn(self, conn):
    try:
      self.threadsLock.acquire()
      self.threads.remove(conn)
    except:
      print("Detected error, exit with code 1")
      sys.exit("Detected error")
    finally:
      self.threadsLock.release()
  def Close(self):
    try:
      self.threadsLock.acquire()
      self.Running = False
      for c in self.threads:
        c.Close()
    finally:
      self.threadsLock.release()

class ConnectionHandler(threading.Thread):
  #           (  c,       self, addr)
  def __init__(self, socClient, server, addr, SSH):
    threading.Thread.__init__(self)
    self.clientClosed = False
    self.targetClosed = True
    self.client = socClient
    self.clientbuffer = ""
    self.server = server
    self.addr = addr
    self.log = "Connection: " + str(addr)
    print("Connection: " + str(addr))
    self.DEFAULT_HOST = SSH
    self.timeout = self.server.Timeout
  def close(self):
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
  def run(self):
    try:
      self.clientbuffer = self.client.recv(self.server.Client_Buffer).decode().split("\r\n")
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
          self.method_CONNECT(hostPort)
        elif len(PASS) != 0 and passwd != PASS:
          self.client.send('HTTP/1.1 400 WrongPass!\r\n\r\n')
        self.method_CONNECT(hostPort)
      else:
        print('- No X-Real-Host!')
        self.client.send('HTTP/1.1 400 NoXRealHost!\r\n\r\n')
    except Exception as e:
      print(str(self.addr) + " - Error: " + str(e))
    finally:
      try:
        self.close()
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
      if self.method == "CONNECT":
        port = 443
      else:
        port = 80
    (soc_family, soc_type, proto, _, address) = getaddrinfo(host, port)[0]
    self.target = socket(soc_family, soc_type, proto)
    self.targetClosed = False
    self.target.connect(address)
  def method_CONNECT(self, path):
    self.connect_target(str(path))
    Menssage_to_send = str(self.server.HTTP_Version) + " " + str(self.server.Code) + " " + str(self.server.Message) + " " + "\r\n\r\n"
    self.client.sendall(bytes(Menssage_to_send, "utf8"))
    self.clientbuffer = ""
    self.doCONNECT()
  def doCONNECT(self):
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
        break
    self.client.close()
    self.target.close()
    self.targetClosed = True
    self.clientClosed = True

def main():
  Args = ArgumentParser(description="Custom http web proxy by Sirherobrine23 (mod)")
  # Web proxy port
  Args.add_argument("-p", "--port", type=int, default=8081, help="Port to listen on")
  # SSH host and port
  Args.add_argument("-s", "--ssh", type=str, default="0.0.0.0:22", help="SSH host and port")
  # Connection timeout
  Args.add_argument("-t", "--timeout", type=int, default=60, help="Connection timeout, If users are disconnecting, it is good to change this value")
  # HTTP status
  Args.add_argument("-c", "--code", type=int, default=101, help="Proxy HTTP status code")
  # HTTP status message
  Args.add_argument("-m", "--message", type=str, default="<font color=\"null\"></font>", help="Proxy HTTP status message")
  # HTTP Version
  Args.add_argument("-v", "--version", type=str, default="HTTP/1.1", help="HTTP version")
  # Client buffer size
  Args.add_argument("-b", "--buffer", type=int, default=1024, help="Buffer size for socket")

  # Parse arguments
  Args = Args.parse_args()
  print("[+] Starting web proxy on port %d" % Args.port)
  print("[+] SSH host: %s" % Args.ssh)
  print("[+] Connection timeout: %d" % Args.timeout)
  print("[+] HTTP status code: %d" % Args.code)
  print("[+] HTTP status message: %s" % Args.message)
  print("[+] HTTP version: %s" % Args.version)
  print("[+] Starting web proxy...")
  try:
    server = Server(Args.port, Args.ssh, Args.timeout, Args.code, Args.message, Args.version, Args.buffer)
    server.run()
  except KeyboardInterrupt:
    print("[+] Exiting...")
    server.close()
    sys.exit(0)

if __name__ == "__main__":
  sys.exit(print(main()))
  