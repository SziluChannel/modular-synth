#!/usr/bin/env python3
"""Convert a Circuit Studio netlist (O/A devices) into local ngspice form."""
import re, sys, math

OPAMPS = {
 'opa':        dict(aol=2e5, gbp=3e6, rin=1e12, rout=75,  vsat=13),
 'opamp_buf':  dict(aol=1e5, gbp=1e6, rin=1e12, rout=100, vsat=11),
 'opamp_res':  dict(aol=2e5, gbp=1e6, rin=1e12, rout=75,  vsat=11),
 'OPAMP':      dict(aol=2e5, gbp=3e6, rin=1e12, rout=75,  vsat=13),
}

def main(src, dst, tran=None, sgn=1, extra=''):
    out=[]
    out.append('* converted by tho.py')
    out.append('.include models.lib')
    out.append('.param VT=0.02585 SGN=%d' % sgn)
    xcount={}
    for raw in open(src):
        line=raw.rstrip('\n')
        t=line.strip()
        if t.startswith(';@') or t.startswith('*@cs'):
            continue
        if t.startswith('.model') and re.match(r'\.model\s+\S+\s+OTA', t, re.I):
            continue
        if t.startswith('.model') and re.match(r'\.model\s+\S+\s+OPAMP', t, re.I):
            continue
        if t.startswith('.control') or t.startswith('.endc') or t.startswith('.tran') or t=='.end':
            continue
        parts=t.split()
        if parts and parts[0][0].upper() in ('A',) and len(parts)==5:
            name,n1,n2,n3,model=parts
            p=OPAMPS.get(model) or OPAMPS['opa']
            out.append('X%s %s %s %s OPA aol=%g gbp=%g rin=1e12 rout=%g vsat=%g'%(name,n1,n2,n3,p['aol'],p['gbp'],p['rout'],p['vsat']))
            continue
        if parts and parts[0][0].upper()=='O' and len(parts)==6:
            name,np_,nn,nc,no,model=parts
            out.append('X%s %s %s %s %s OTA'%(name,np_,nn,nc,no))
            continue
        out.append(line)
    out.append('')
    out.append(extra)
    out.append(tran if tran else '.tran 4u 60m 0 4u UIC')
    out.append('.end')
    open(dst,'w').write('\n'.join(out)+'\n')

if __name__=='__main__':
    src=sys.argv[1]; dst=sys.argv[2]
    tran=sys.argv[3] if len(sys.argv)>3 else None
    main(src,dst,tran=tran)
