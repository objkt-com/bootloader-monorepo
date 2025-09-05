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


nft_deployer = ContractDeployment.from_name('svg_nft')
nft_deployer.update_storage({
    "administrator": wallet.public_key_hash()
})
nft_deployer.set_pytezos_client(pt)
# nft_deployer.use_cache()
nft_deployer.set_network(Network.ghostnet)
nft_address = nft_deployer.deploy()
nft = pt.contract(nft_address)
token_id = nft.storage()['next_token_id']
prefix = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="100" height="100">'
circle_1 = '<circle r="'
circle_2 = '" cx="'
circle_3 = '" cy="'
circle_4 = '" fill="red" />'
svg_end = '</svg>'
fragments = [prefix, circle_1, circle_2, circle_3, circle_4, svg_end]
print("adding fragments")
ops = []
for i, fragment in enumerate(fragments):
    ops.append(nft.add_fragment(frag_id=i, frag=fragment.encode()))
print(pt.bulk(*ops).send(min_confirmations=1).hash())

print(nft.mint(os.urandom(16)).send(min_confirmations=1).hash())
print(f'https://ghostnet.objkt.com/tokens/{nft_address}/{token_id}')
