import ast, hashlib, json, pathlib, re
from hermes_dec.parsers.hbc_file_parser import HBCReader
from hermes_dec.parsers.hbc_bytecode_parser import parse_hbc_bytecode
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'mobile/index.android.bundle'
b=bytearray(source.read_bytes())
assert hashlib.sha256(b).hexdigest()=='027d40cea4063f4d1e8c2658319adf6ec2eee3492c96291814963278ab61c07c'
with source.open('rb') as f:
 h=HBCReader();h.read_whole_file(f)
 ops=list(parse_hbc_bytecode(h.function_headers[0],h))
 reg={};modules=[]
 for op in ops:
  name=op.inst.name
  if name in ('LoadConstInt','LoadConstUInt8','LoadConstDouble'):reg[op.arg1]=op.arg2
  elif name=='LoadConstZero':reg[op.arg1]=0
  elif name=='LoadConstString':reg[op.arg1]=h.strings[op.arg2]
  elif name in ('Mov','MovLong'):reg[op.arg1]=reg.get(op.arg2)
  elif name=='CreateClosure':reg[op.arg1]={'fn':op.arg3}
  elif name.startswith('NewArrayWithBuffer'):
   match=re.search(r'# Array: (.*)',repr(op));reg[op.arg1]=ast.literal_eval(re.sub(r'\b(null|undefined|true|false)\b', lambda m: {'null':'None','undefined':'None','true':'True','false':'False'}[m[1]], match[1])) if match else None
  elif name=='NewArray':reg[op.arg1]=[]
  elif name in ('TryGetById','GetById','GetByIdShort'):reg[op.arg1]=h.strings[op.arg4]
  elif name=='Call4' and reg.get(op.arg2)=='__d':
   fn=reg.get(op.arg4);mid=reg.get(op.arg5);deps=reg.get(op.arg6)
   if isinstance(fn,dict) and 'fn' in fn:modules.append({'id':mid,'fn':fn['fn'],'deps':deps})
   reg[op.arg1]=None
 # Stop immediately before the three entry-point __r calls, after registration.
 cut=ops[-7]
 assert cut.original_pos==0x42066 and '__r' in repr(cut)
 final=ops[-1];assert final.inst.name=='Ret'
 at=h.function_headers[0].offset+cut.original_pos
 ret_at=h.function_headers[0].offset+final.original_pos
 b[at:at+2]=b[ret_at:ret_at+2]
 b[-20:]=hashlib.sha1(b[:-20]).digest()
(root/'generated').mkdir(exist_ok=True)
(root/'generated/rules.hbc').write_bytes(b)
(root/'research/mobile-modules.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2),encoding='utf8')
print('Registered modules:',len(modules))
print([m for m in modules if m['fn'] in (4100,4099,4097,784)])
