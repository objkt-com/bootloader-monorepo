```assembly
bootloader:
    ; an open experimental on-chain long-form generative art platform on Tezos

_getting_started:
    ; compile smart contracts
    pipenv shell
    pipenv install
    python compile.py

    ; deploy smart contracts
    export TEZOS_PRIVATE_KEY=your-private-key
    python deploy.py --network ghostnet

    ; run frontend
    cd frontend
    npm install
    npm run dev

_objkt_labs:
    ; part of objkt labs
```
