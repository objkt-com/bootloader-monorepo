from pytezos import pytezos
from pytezos.crypto.key import Key
from hashlib import sha256
from utils import ContractDeployment, Network
import os

def get_wallet(name):
    return Key.from_secret_exponent(sha256(name.encode()).digest())

wallet = get_wallet("svg_test")
print(wallet.public_key_hash())

pt = pytezos.using(key=wallet.secret_key(), shell="https://ghostnet.smartpy.io")

with open("templates/v0/template") as f:
    fragments = f.readlines()

with open("templates/v0/example") as f:
    code = f.read()

nft_deployer = ContractDeployment.from_name('svjkt')
nft_deployer.update_storage({
    "administrator": wallet.public_key_hash()
})
nft_deployer.set_pytezos_client(pt)
# nft_deployer.use_cache()
nft_deployer.set_network(Network.ghostnet)
nft_address = nft_deployer.deploy()
nft = pt.contract(nft_address)
token_id = nft.storage()['next_token_id']


print("adding fragments")
ops = []
for i, fragment in enumerate(fragments):
    ops.append(nft.add_fragment(frag_id=i, frag=fragment.encode()))
print(pt.bulk(*ops).send(min_confirmations=1).hash())

print(nft.create_generator(name="Test".encode(), description="Test".encode(), code=code.encode(), royalty_address=wallet.public_key_hash().encode()).send(min_confirmations=1).hash())

for i in range(3):
    print(nft.mint(generator_id=0, entropy=os.urandom(16)).send(min_confirmations=1).hash())
    print(f'https://ghostnet.objkt.com/tokens/{nft_address}/{token_id+i}')
