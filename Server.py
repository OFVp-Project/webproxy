from socket import AF_INET, SO_REUSEADDR, socket, timeout
from ssl import SOL_SOCKET
import threading
from ConenctionHandler import ConnectionHandler

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

  def closeServer(self):
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

  def AddConn(self, conn):
    try:
      self.threadsLock.acquire()
      if self.Running:
        self.threads.append(conn)
    finally:
      self.threadsLock.release()

  def startServer(self):
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


  def RemoveConn(self, conn):
    try:
      self.threadsLock.acquire()
      self.threads.remove(conn)
    except:
      pass
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
      self.logLock.release()