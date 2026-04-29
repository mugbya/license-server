#!/usr/bin/env python3
"""Generate RSA keys for license signing"""
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Generate RSA private key (2048 bits)
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)

# Generate public key
public_key = private_key.public_key()

# Serialize private key to PEM format
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
)

# Serialize public key to PEM format
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

print("=" * 60)
print("Private Key (save to private.py as LICENSE_PRIVATE_KEY):")
print("=" * 60)
print(private_pem.decode())

print("=" * 60)
print("Public Key (will be embedded in client):")
print("=" * 60)
print(public_pem.decode())

# Also print as single line for easy copying
print("=" * 60)
print("Private Key (single line for private.py):")
print("=" * 60)
print(repr(private_pem.decode()))

print("\nPublic Key (single line for client):")
print(repr(public_pem.decode()))