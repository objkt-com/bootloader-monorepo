#!/usr/bin/env python3

import argparse
import os
import sys
from pytezos import pytezos
from pytezos.crypto.key import Key
from hashlib import sha256
from utils import ContractDeployment, Network, load_lambda_from_name, get_tezos_storage
from templates import get_fragments_from_template

def get_wallet_from_env():
    """Get wallet from environment variable"""
    private_key = os.getenv('TEZOS_PRIVATE_KEY')
    if not private_key:
        print("Error: TEZOS_PRIVATE_KEY environment variable not set")
        print("Please set your private key: export TEZOS_PRIVATE_KEY='your_private_key_here'")
        sys.exit(1)
    
    try:
        return Key.from_encoded_key(private_key)
    except Exception as e:
        print(f"Error: Invalid private key format: {e}")
        print("Please ensure TEZOS_PRIVATE_KEY is a valid Tezos private key")
        sys.exit(1)

def get_wallet_test(name):
    """Get test wallet (for development only)"""
    return Key.from_secret_exponent(sha256(name.encode()).digest())

def main():
    parser = argparse.ArgumentParser(description='Deploy bootloader contracts to Tezos')
    parser.add_argument(
        '--network', 
        choices=['ghostnet', 'mainnet'], 
        required=True,
        help='Network to deploy to (ghostnet or mainnet)'
    )
    parser.add_argument(
        '--use-cache', 
        action='store_true',
        help='Use cached contract addresses when available'
    )
    parser.add_argument(
        '--clear-cache', 
        action='store_true',
        help='Clear cached contract addresses before deployment'
    )
    parser.add_argument(
        '--test-wallet', 
        action='store_true',
        help='Use test wallet instead of environment key (development only)'
    )
    
    args = parser.parse_args()
    
    # Get network
    if args.network == 'ghostnet':
        network = Network.ghostnet
    elif args.network == 'mainnet':
        network = Network.mainnet
    
    # Get wallet
    if args.test_wallet:
        print("WARNING: Using test wallet (development only)")
        wallet = get_wallet_test("bootloader_test")
    else:
        wallet = get_wallet_from_env()
    
    print(f"Deploying with wallet: {wallet.public_key_hash()}")
    print(f"Network: {args.network}")
    
    # Initialize PyTezos client
    pt = pytezos.using(key=wallet.secret_key(), shell=network)
    
    # Load template fragments
    fragments = get_fragments_from_template('templates/v0.0.1')
    
    # Try existing randomiser on ghostnet first
    print("Deploying randomiser contract")
    randomiser_deployer = ContractDeployment.from_name('randomiser')
    randomiser_deployer.update_storage({
        "testnet_mode": network == Network.ghostnet
    })
    randomiser_deployer.set_pytezos_client(pt)
    randomiser_deployer.set_network(network)
    
    if args.use_cache:
        randomiser_deployer.use_cache()
    
    if args.clear_cache:
        randomiser_deployer.clear_cache()
        
        randomiser_address = randomiser_deployer.deploy()
    
    metadata = get_tezos_storage(
        name="bootloader:",
        description="open experimental on-chain long-form generative art",
        imageUri="ipfs://bafkreic2zzpvkzfztgwrlavpit2psrip5xcgqfov4hq6ec4r5ds5didxim",
        homepage=f"https://{'ghostnet.' if args.network == 'ghostnet' else ''}bootloader.art",
    )
    
    # Deploy bootloader contract
    print("Deploying bootloader contract")
    nft_deployer = ContractDeployment.from_name('bootloader')
    nft_deployer.update_storage({
        "metadata": metadata,
        "administrator": wallet.public_key_hash(),
        "rng_contract": randomiser_address,
        "treasury": wallet.public_key_hash(),
        "platform_fee_bps": 2_000,
    })
    nft_deployer.set_pytezos_client(pt)
    nft_deployer.set_network(network)
    
    if args.use_cache:
        nft_deployer.use_cache()
    
    if args.clear_cache:
        nft_deployer.clear_cache()
    
    nft_address = nft_deployer.deploy()
    nft = pt.contract(nft_address)
    
    print("Adding generator type")
    
    # Load the lambda function
    bootloader = load_lambda_from_name('lambda_0_0_1')
    if args.network == 'ghostnet':
        bootloader = load_lambda_from_name('lambda_0_0_1_ghostnet')

    
    # Add bootloader to contract
    operation_hash = nft.add_bootloader(
        version='svg-js:0.0.1'.encode(), 
        fragments=[f.encode() for f in fragments], 
        fun=bootloader,
        storage_limits={
            "code": 30000,
            "desc": 8000,
            "name": 100,
            "author": 36,
        }
    ).send(min_confirmations=1).hash()
    
    print(f"Bootloader added successfully: {operation_hash}")
    print(f"Bootloader contract: {nft_address}")
    print(f"Randomiser contract: {randomiser_address}")

if __name__ == "__main__":
    main()
