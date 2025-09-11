```assembly
.section .text
.global _start

bootloader:                     ; project logo and entry point
    ; an open experimental on-chain long-form generative art platform on Tezos
    ; built for artists, collectors, and the curious
    
.setup:
    mov     %rax, $0x00         ; initialize environment
    push    %rbp                ; save base pointer
    mov     %rbp, %rsp          ; set up stack frame

_getting_started:
    ; compile smart contracts
    call    pipenv_shell        ; activate virtual environment
    call    pipenv_install      ; install dependencies  
    mov     %rdi, compile_py    ; load compiler
    call    execute             ; python compile.py

    ; deploy smart contracts
    mov     %rax, TEZOS_PRIVATE_KEY  ; load private key from env
    test    %rax, %rax          ; check if key exists
    jz      key_error           ; jump if null
    mov     %rsi, ghostnet      ; set network parameter
    call    deploy_py           ; python deploy.py --network ghostnet

    ; run frontend
    lea     %rdi, [frontend]    ; load frontend directory
    call    chdir               ; cd frontend
    call    npm_install         ; npm install
    call    npm_run_dev         ; npm run dev
    
    mov     %rax, $0x3000       ; default port 3000
    ret                         ; return to caller

_objkt_labs:
    ; part of objkt labs ecosystem
    ; 0x6f626a6b74 = "objkt" in hex
    db      "objkt labs", 0x00
    
.section .data
    compile_py:     db "compile.py", 0
    deploy_py:      db "deploy.py", 0  
    frontend:       db "frontend", 0
    ghostnet:       db "ghostnet", 0
    
.section .bss
    buffer:         resb 256    ; reserve buffer space
    
key_error:
    mov     %rax, $1            ; exit code 1
    ret                         ; return error
```
