```assembly
bootloader:
    Open experimental on-chain long-form generative art on Tezos.

.getting_started:
    ; compile smart contracts
    pipenv shell
    pipenv install
    python compile.py

    ; deploy smart contracts
    python deploy.py

    ; run frontend
    cd frontend
    npm install
    npm run dev

pipenv shell
pip install pytezos tezos-smartpy
python contracts/bootloader.py
```
