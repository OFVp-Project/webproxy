#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from argparse import ArgumentParser
import sys
from Server import Server

def main():
  Args = ArgumentParser(description="Custom http web proxy by Sirherobrine23 (mod)")
  # Web proxy port
  Args.add_argument("-p", "--port", type=int, default=80, help="Port to listen on")
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
  print("wsSSH: Starting web proxy on port %d" % Args.port)
  print("wsSSH: SSH host: %s" % Args.ssh)
  print("wsSSH: Connection timeout: %d" % Args.timeout)
  print("wsSSH: HTTP status code: %d" % Args.code)
  print("wsSSH: HTTP status message: %s" % Args.message)
  print("wsSSH: HTTP version: %s" % Args.version)
  print("wsSSH: Starting web proxy...\n****** LOG ******\n")
  try:
    server = Server(Args.port, Args.ssh, Args.timeout, Args.code, Args.message, Args.version, Args.buffer)
    server.startServer()
  except KeyboardInterrupt:
    print("wsSSH: Stopping web proxy...")
    server.closeServer()
    print("wsSSH: Exiting...")
    sys.exit(0)

if __name__ == "__main__":
  sys.exit(print(main()))
