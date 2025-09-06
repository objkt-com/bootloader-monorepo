from pytezos import pytezos
from pytezos.crypto.key import Key
from hashlib import sha256
from utils import ContractDeployment, Network
from templates import get_fragments_from_template
import os

def get_wallet(name):
    return Key.from_secret_exponent(sha256(name.encode()).digest())

wallet = get_wallet("svg_test")
print(wallet.public_key_hash())

pt = pytezos.using(key=wallet.secret_key(), shell="https://ghostnet.smartpy.io")

fragments = get_fragments_from_template('v0.0.1')

randomiser_address = 'KT1Vn34jRFpo3q5fAsYA5wT3X4zc7WhpuQas'

try:
    pt.contract(randomiser_address)
except Exception as e:
    print("overriding randomiser on ghostnet")
    randomiser_deployer = ContractDeployment.from_name('randomiser')
    randomiser_deployer.set_pytezos_client(pt)
    randomiser_deployer.use_cache()
    randomiser_deployer.set_network(Network.ghostnet)
    randomiser_address = randomiser_deployer.deploy()

nft_deployer = ContractDeployment.from_name('svgkt')
nft_deployer.update_storage({
    "administrator": wallet.public_key_hash(),
    "rng_contract": randomiser_address,
    "treasury": wallet.public_key_hash(),
    "platform_fee_bps": 2_000,
})
nft_deployer.set_pytezos_client(pt)
nft_deployer.set_network(Network.ghostnet)
nft_address = nft_deployer.deploy()
nft = pt.contract(nft_address)
token_id = nft.storage()['next_token_id']


print("adding fragments")
ops = []
for i, fragment in enumerate(fragments):
    ops.append(nft.add_fragment(frag_id=i, frag=fragment.strip().encode()))
print(pt.bulk(*ops).send(min_confirmations=1).hash())
