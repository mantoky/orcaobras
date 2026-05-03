#!/usr/bin/env python3
"""
OrçaObras - Script para iniciar servidor local
==============================================
Execute este script para rodar o aplicativo localmente.

Uso:
    python iniciar.py

O aplicativo estará disponível em:
    http://localhost:8080
"""

import http.server
import socketserver
import os
import webbrowser
import sys

PORT = 8080
DIRETORIO = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def iniciar_servidor():
    os.chdir(DIRETORIO)

    Handler = http.server.SimpleHTTPRequestHandler

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("\n" + "=" * 50)
        print("   OrçaObras - Sistema de Orçamentos")
        print("=" * 50)
        print(f"\n   Servidor iniciado em http://localhost:{PORT}")
        print(f"   Pasta: {DIRETORIO}")
        print("\n   Pressione Ctrl+C para encerrar")
        print("=" * 50 + "\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n   Servidor encerrado.")
            sys.exit(0)

if __name__ == "__main__":
    iniciar_servidor()