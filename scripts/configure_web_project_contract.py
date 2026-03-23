#!/usr/bin/env python3

import argparse
import os
import sys

from pytezos import pytezos
from pytezos.crypto.key import Key

from utils import Network

BOOT_WEB_SPEC = "boot:web@1.0.0"
BOOT_P5_SPEC = "boot:p5@1.0.0"


def get_wallet_from_env() -> Key:
    private_key = os.getenv("TEZOS_PRIVATE_KEY", "").strip()
    if not private_key:
        print("Error: TEZOS_PRIVATE_KEY environment variable not set")
        sys.exit(1)
    return Key.from_encoded_key(private_key)


def resolve_artifact_signer_public_key(args: argparse.Namespace) -> str | None:
    explicit = (args.artifact_signer_public_key or "").strip()
    if explicit:
        return explicit

    from_public_env = os.getenv("ARTIFACT_SIGNER_PUBLIC_KEY", "").strip()
    if from_public_env:
        return from_public_env

    from_private_env = os.getenv("ARTIFACT_SIGNER_PRIVATE_KEY", "").strip()
    if from_private_env:
        return Key.from_encoded_key(from_private_env).public_key()

    return None


def bytes_literal(value: str) -> bytes:
    return value.encode()


def configure_bootloader_spec(
    contract,
    spec: str,
    signer_public_key: str | None,
):
    signer = signer_public_key if signer_public_key else None
    return (
        contract.set_bootloader_spec(
            spec_id=bytes_literal(spec),
            active=True,
            signer=signer,
        )
        .send(min_confirmations=1)
        .hash()
    )


def main():
    parser = argparse.ArgumentParser(
        description="Configure boot:web / p5 bootloader specs on a deployed generic-web core contract"
    )
    parser.add_argument(
        "--network",
        choices=["shadownet", "mainnet"],
        required=True,
        help="Target network",
    )
    parser.add_argument(
        "--contract",
        required=True,
        help="Deployed generic-web/core contract address",
    )
    parser.add_argument(
        "--artifact-signer-public-key",
        required=False,
        help="edpk/... public key used by the worker artifact signer",
    )
    args = parser.parse_args()

    network = Network.shadownet if args.network == "shadownet" else Network.mainnet
    wallet = get_wallet_from_env()
    signer_public_key = resolve_artifact_signer_public_key(args)

    print(f"Configuring contract: {args.contract}")
    print(f"Network: {network}")
    print(f"Admin wallet: {wallet.public_key_hash()}")
    print(
        "Artifact signer:"
        + (f" {signer_public_key}" if signer_public_key else " none (signature disabled)")
    )

    pt = pytezos.using(key=wallet.secret_key(), shell=network)
    contract = pt.contract(args.contract)

    web_hash = configure_bootloader_spec(contract, BOOT_WEB_SPEC, signer_public_key)
    print(f"Configured {BOOT_WEB_SPEC}: {web_hash}")

    p5_hash = configure_bootloader_spec(contract, BOOT_P5_SPEC, signer_public_key)
    print(f"Configured {BOOT_P5_SPEC}: {p5_hash}")

    print("Done.")


if __name__ == "__main__":
    main()
