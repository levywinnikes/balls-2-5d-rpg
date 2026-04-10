import sys
import os

filename = r'src/game/entities/Player/PlayerState.ts'
if not os.path.exists(filename):
    print(f"File not found: {filename}")
    sys.exit(1)

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    clean_line = line
    if '//' in clean_line:
        clean_line = clean_line.split('//')[0]
    
    open_c = clean_line.count('{')
    close_c = clean_line.count('}')
    
    prev_balance = balance
    balance += open_c - close_c
    
    if balance == 0 and prev_balance > 0:
        print(f"BALANCE ZERO at line {i+1}")
    
    if balance < 0:
        print(f"NEGATIVE BALANCE at line {i+1}: {balance}")
        break

print(f"Final balance: {balance}")
