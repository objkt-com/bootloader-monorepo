import smartpy as sp
from smartpy.templates import fa2_lib as fa2
from utils import bytes_utils

# Main template for FA2 contracts
main = fa2.main


@sp.module
def svg_nft():
    import main
    import bytes_utils


    def log_2(n: sp.nat) -> sp.nat:
        j = 1
        c = 0
        while j < n:
            j *= 2
            c += 1
        return c

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class SVGNFT(
        main.Admin,
        main.Nft,
        main.MintNft,
        main.BurnNft,
        main.OnchainviewBalanceOf,
    ):
        def __init__(self, admin_address, contract_metadata, ledger, token_metadata):
            """Initializes the contract with administrative permissions and NFT functionalities.
            The base class is required; all mixins are optional.
            The initialization must follow this order:

            - Other mixins such as OnchainviewBalanceOf, MintNFT, and BurnNFT
            - Base class: NFT
            - Transfer policy
            - Admin
            """

            # Initialize on-chain balance view
            main.OnchainviewBalanceOf.__init__(self)

            # Initialize the NFT-specific entrypoints
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)

            # Initialize the NFT base class
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)

            # Initialize administrative permissions
            main.Admin.__init__(self, admin_address)
            self.data.next_token_id = 0
            self.data.frags = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.bytes])
        
        @sp.entrypoint
        def add_fragment(self, frag_id: sp.nat, frag: sp.bytes):
            assert self.data.administrator == sp.sender
            self.data.frags[frag_id] = frag

        @sp.entrypoint
        def mint(self, entropy: sp.bytes): 
            # Construct the artifactUri as a svg that is rendered on-chain
            # create a simple util in python to convert svg primitives into a
            # base64 buildable data uri. Start with something simple like circles
            # and squares of different sizes that are assembled on-chain)
            svg_string = self.data.frags[0] # datauri + svg
            svg_string += entropy

            self.data.ledger[self.data.next_token_id] = sp.sender
            self.data.token_metadata[self.data.next_token_id] = sp.record(
                token_id=self.data.next_token_id,
                token_info={
                    "name": sp.bytes("0x7376672023") + bytes_utils.from_int(sp.to_int(self.data.next_token_id)),
                    "artifactUri": svg_string,
                }
            )
            self.data.next_token_id += 1

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("svg_nft")

    # Define test accounts
    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    prefix = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="100" height="100">'
    circle_1 = '<circle r="'
    circle_2 = '" cx="'
    circle_3 = '" cy="'
    circle_4 = '" fill="red" />'
    svg_end = '</svg>'
    fragments = [prefix, circle_1, circle_2, circle_3, circle_4, svg_end]

    # Instantiate the FA2 NFT contract
    contract = svg_nft.SVGNFT(
        admin.address, sp.big_map({}), {}, []
    )
    scenario += contract
    for i, fragment in enumerate(fragments):
        contract.add_fragment(sp.record(frag_id=i, frag=sp.bytes("0x" + fragment.encode().hex())), _sender=admin.address)
    import os
    for i in range(10):
        contract.mint(sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address)