import glob
from pytezos import pytezos
from pytezos.client import PyTezosClient
from pytezos.contract.interface import ContractInterface
from pytezos.operation.result import OperationResult
from enum import StrEnum
import inspect
import json
import time
import tempfile
import os
from datetime import datetime

def str_to_hex(string):
    return "".join("{:02x}".format(ord(c)) for c in string)

def load_code_and_storage(name):
    """load contract and storage from corresponding .tz files"""

    code_glob = "%s/*contract.tz" % name
    storage_glob = "%s/*storage.tz" % name
    code_path = glob.glob(code_glob)[0]
    storage_path = glob.glob(storage_glob)[0]

    contract = ContractInterface.from_file(code_path)
    with open(storage_path) as f:
        storage = contract.storage.decode(f.read())
    return contract, storage

def get_tezos_storage(**metadata):
    return {
        "": str_to_hex("tezos-storage:meta"),
        "meta": str_to_hex(
            json.dumps(
                metadata
            )
        )
    }

def load_lambda_from_name(name):
    storage_glob = "%s/*storage.tz" % name
    storage_path = glob.glob(storage_glob)[0]

    with open(storage_path) as f:
        return f.read()

class Network(StrEnum):
    localnet = 'http://localhost:20000'
    ghostnet = 'https://ghostnet.smartpy.io'
    mainnet = 'https://rpc.tzkt.io/mainnet'

class ContractDeployment:
        
    def __init__(self, contract: ContractInterface, storage, client: PyTezosClient, _name: str):
        self.contract: ContractInterface = contract
        self.storage = storage
        self.client = client
        self._name = _name
        self._cache = False
        self._address = None
        self._network = None
    
    @classmethod
    def from_name(cls, name: str) -> 'ContractDeployment':
        contract, storage = load_code_and_storage(name)
        return cls(contract, storage, pytezos, _name=name)

    def use_cache(self):
        self._cache = True
    
    def using(self, **kwargs):
        self.client = self.client.using(**kwargs)

    def get_address(self) -> str:
        return self.client.key.public_key_hash()
    
    def get_public_key(self) -> str:
        return self.client.key.public_key()
    
    def load_contract(self, name: str):
        self.script, self.storage = load_code_and_storage(name)
    
    def update_storage(self, update_dict: dict):
        if isinstance(self.storage , dict):
            self.storage.update(**update_dict)
        else:
            self.storage=update_dict
    
    def set_network(self, network: Network):
        self._network = network
        if network == Network.mainnet:
            print("WARNING: SWITCHING TO MAINNET")
            for _ in range(3):
                time.sleep(1)
                print(".", end='')
        elif network == Network.ghostnet:
            print("Switching to ghostnet")
        self.client = self.client.using(network)
    
    def deploy(self):
        # Check cache first if caching is enabled
        if self._cache:
            cached_address = self.load_from_cache()
            if cached_address:
                print(f"Using cached contract address for {self._name}: {cached_address}")
                self._address = cached_address
                return cached_address
        
        print("Deploying", self._name)
        operation_group = self.client.origination(script=self.contract.script(initial_storage=self.storage)).send()
        og_hash = operation_group.hash()
        print("\toperation sent:", og_hash)
        address = self.__get_address(og_hash)
        print("\tdeployed at", address)
        
        # Save to cache if caching is enabled
        if self._cache:
            self._address = address
            self.save_to_cache(address)
        
        return address

    def get_cache_path(self):
        # Use default network if none is set
        network_name = self._network.name if self._network else 'localnet'
        
        # Get the script name from the call stack (2 levels up to skip this method and the calling method)
        try:
            file_name = inspect.stack()[-1][1].split("/")[-1].split('.')[0]
        except (IndexError, AttributeError):
            file_name = 'unknown_script'
        
        cache_name = f'{file_name}-{network_name}-{self._name}.json'
        
        # Create cache directory in temp folder
        cache_dir = os.path.join(tempfile.gettempdir(), 'objkt_contracts')
        os.makedirs(cache_dir, exist_ok=True)
        return os.path.join(cache_dir, cache_name)

    def cache_exists(self):
        """Check if cache file exists for this contract"""
        try:
            cache_path = self.get_cache_path()
            return os.path.exists(cache_path)
        except Exception as e:
            print(f"Error checking cache existence: {e}")
            return False

    def load_from_cache(self):
        """Load contract address from cache if it exists"""
        try:
            cache_path = self.get_cache_path()
            if os.path.exists(cache_path):
                with open(cache_path, 'r') as f:
                    cache_data = json.load(f)
                    return cache_data.get('contract_address')
            else:
                print(f"No cache file found at: {cache_path}")
        except Exception as e:
            print(f"Error loading from cache: {e}")
        return None

    def save_to_cache(self, address):
        """Save contract address to cache"""
        try:
            cache_path = self.get_cache_path()
            try:
                file_name = inspect.stack()[2][1].split("/")[-1].split('.')[0]
            except (IndexError, AttributeError):
                file_name = 'unknown_script'
            
            cache_data = {
                'contract_address': address,
                'deployment_timestamp': datetime.now().isoformat(),
                'network': str(self._network) if self._network else 'localnet',
                'contract_name': self._name,
                'script_name': file_name
            }
            
            with open(cache_path, 'w') as f:
                json.dump(cache_data, f, indent=2)
            print(f"\tCached contract address to: {cache_path}")
        except Exception as e:
            print(f"Error saving to cache: {e}")

    def get_cached_address(self):
        """Get cached address without deploying"""
        return self.load_from_cache()

    def clear_cache(self):
        """Remove cache file for this contract"""
        try:
            cache_path = self.get_cache_path()
            if os.path.exists(cache_path):
                os.remove(cache_path)
                print(f"Cache cleared: {cache_path}")
                return True
            else:
                print(f"No cache file to clear at: {cache_path}")
                return True  # Consider it successful if there's nothing to clear
        except Exception as e:
            print(f"Error clearing cache: {e}")
        return False

    def set_pytezos_client(self, client: PyTezosClient):
        self.pytezos_client = client

    def __get_address(self, operation_hash):
        while True:
            try:
                opg = self.client.shell.blocks[-2:].find_operation(
                    operation_hash
                )
                originated_contracts = OperationResult.originated_contracts(opg)
                if len(originated_contracts) >= 1:
                    return originated_contracts[0]
            except:
                time.sleep(1)