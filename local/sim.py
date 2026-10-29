#!/usr/bin/env python3
"""
Simulate a Circuit Studio netlist locally with ngspice.

    python3 sim.py tran <netlist> <node> [node ...]   # transient metrics
    python3 sim.py ac   <netlist> <node> [...]        # 20 Hz..20 kHz sweep
    python3 sim.py wave <netlist> <node> [tstart]     # dump waveform stats

Options: --tstop=60m --tstep=4u --sgn=1|-1 --lo=20 --hi=20k --settle=0.6
"""
import math, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
POLE = 'auto'   # 'auto' = pole at gbp/aol, 'gbp', 'ideal'
WORK = os.path.join(HERE, 'work')

OPAMPS = {
    'opa':       dict(aol=2e5, gbp=3e6, rout=75,  vsat=13),
    'opamp_buf': dict(aol=1e5, gbp=1e6, rout=100, vsat=11),
    'opamp_res': dict(aol=2e5, gbp=1e6, rout=75,  vsat=11),
    'OPAMP':     dict(aol=2e5, gbp=3e6, rout=75,  vsat=13),
    'OA_TL07X':  dict(aol=2e5, gbp=3e6, rout=75,  vsat=13.5),
    'OP_BLK':    dict(aol=2e5, gbp=3e6, rout=75,  vsat=11),
    'OP_LFO':    dict(aol=2e5, gbp=3e6, rout=50,  vsat=13),
    'OP_CMP':    dict(aol=5e3, gbp=2e9, rout=50,  vsat=6),
}

def convert(src, sgn=1):
    out = ['* converted from ' + os.path.basename(src),
           '.include %s' % os.path.join(HERE, 'models.lib'),
           '.options method=gear']
    for raw in open(src, errors='replace'):
        t = raw.strip()
        if not t:
            continue
        if t.startswith(';@') or t.startswith('*@cs'):
            continue
        if re.match(r'\.model\s+\S+\s+(OTA|OPAMP)\b', t, re.I):
            continue
        if t.split()[0] in ('.control', '.endc', '.tran', '.end'):
            continue
        p = t.split()
        if p[0][0] in 'Aa' and len(p) == 5:
            m = OPAMPS.get(p[4], OPAMPS['opa'])
            if POLE == 'auto':
                pole = m['gbp'] / m['aol']
            elif POLE == 'gbp':
                pole = m['gbp']
            else:
                pole = 1e12
            out.append('X%s %s %s %s OPA aol=%g gbp=%g rout=%g vsat=%g pole=%g'
                       % (p[0], p[1], p[2], p[3], m['aol'], m['gbp'], m['rout'], m['vsat'], pole))
            continue
        if p[0][0] in 'Oo' and len(p) == 6:
            a, b = (p[1], p[2]) if sgn > 0 else (p[2], p[1])
            out.append('X%s %s %s %s %s OTA' % (p[0], a, b, p[3], p[4]))
            continue
        out.append(t)
    return out

def run(basename, lines, cards, ctrl):
    os.makedirs(WORK, exist_ok=True)
    net = os.path.join(WORK, basename + '.cir')
    body = list(lines) + list(cards) + ['.control'] + ctrl + ['.endc', '.end']
    open(net, 'w').write('\n'.join(body) + '\n')
    r = subprocess.run(['ngspice', '-b', net], capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        print('ngspice failed:')
        print((r.stdout + r.stderr)[-2500:])
    return r

def cols(path):
    rows = []
    if not os.path.exists(path):
        return rows
    for ln in open(path):
        f = ln.split()
        if len(f) == 2:
            try:
                rows.append((float(f[0]), float(f[1])))
            except ValueError:
                pass
    return rows

def tran(src, nodes, tstop='60m', tstep='4u', sgn=1, settle=0.6):
    lines = convert(src, sgn)
    print('%-9s %9s %9s %9s %9s %9s' % ('node', 'dc', 'peak', 'pp', 'rms', 'clip'))
    for n in nodes:
        out = os.path.join(WORK, 'w_%s.txt' % re.sub(r'\W', '_', n))
        if os.path.exists(out):
            os.remove(out)
        run('t', lines, ['.tran %s %s 0 %s UIC' % (tstep, tstop, tstep)],
            ['run', 'wrdata %s v(%s)' % (out, n)])
        rows = cols(out)
        if not rows:
            print('%-9s   no data' % n); continue
        t1 = rows[-1][0] * settle
        v = [y for x, y in rows if x >= t1] or [y for _, y in rows]
        dc = sum(v) / len(v)
        dev = [y - dc for y in v]
        pk = max(abs(d) for d in dev)
        rms = math.sqrt(sum(d * d for d in dev) / len(v))
        clip = 'yes' if pk > 12.5 else ''
        print('%-9s %9.4f %9.4f %9.4f %9.4f %9s'
              % (n, dc, pk, max(v) - min(v), rms, clip))

def ac(src, nodes, sgn=1, lo=20, hi=20000, pts=120):
    lines = convert(src, sgn)
    for n in nodes:
        out = os.path.join(WORK, 'ac_%s.txt' % re.sub(r'\W', '_', n))
        if os.path.exists(out):
            os.remove(out)
        run('a', lines, ['.ac dec %d %g %g' % (max(1, pts // 40), lo, hi)],
            ['run', 'wrdata %s vm(%s) vp(%s)' % (out, n, n)])
        rows = []
        for ln in open(out):
            f = ln.split()
            if len(f) >= 4:
                try:
                    rows.append((float(f[0]), float(f[1]), float(f[3])))
                except ValueError:
                    pass
        print('--- %s ---' % n)
        print('%10s %10s %9s' % ('f (Hz)', '|H|', 'phase'))
        step = max(1, len(rows) // 12)
        for i in range(0, len(rows), step):
            f, mag, ph = rows[i]
            print('%10.1f %10.4f %9.1f' % (f, mag, ph))

def cost(src, tstop='100m', tstep='1u', sgn=1, reps=3):
    import time, statistics
    lines = convert(src, sgn)
    times, rows = [], None
    for _ in range(reps):
        t0 = time.time()
        r = run('c', lines, ['.tran %s %s' % (tstep, tstop)], ['run'])
        times.append(time.time() - t0)
        m = re.search(r'No\. of Data Rows\s*:\s*(\d+)', r.stdout)
        if m:
            rows = int(m.group(1))
    print('%-38s rows=%-7s wall=%.3fs (median of %d)'
          % (os.path.basename(src), rows, statistics.median(times), reps))


def wave(src, node, tstart='0.3', tstop='400m', tstep='2u', sgn=1):
    lines = convert(src, sgn)
    out = os.path.join(WORK, 'wave.txt')
    if os.path.exists(out):
        os.remove(out)
    run('w', lines, ['.tran %s %s 0 %s UIC' % (tstep, tstop, tstep)],
        ['run', 'wrdata %s v(%s)' % (out, node)])
    rows = [(t, v) for t, v in cols(out) if t >= float(tstart)]
    if not rows:
        print('no data'); return
    vs = [v for _, v in rows]
    print('%s: n=%d min=%.4f max=%.4f mean=%.4f' %
          (node, len(rows), min(vs), max(vs), sum(vs) / len(vs)))
    cross = []
    for i in range(1, len(rows)):
        a, b = rows[i - 1][1], rows[i][1]
        if a < 0 <= b:
            t0, t1 = rows[i - 1][0], rows[i][0]
            cross.append(t0 + (t1 - t0) * (-a) / (b - a))
    if len(cross) > 1:
        per = [cross[i] - cross[i - 1] for i in range(1, len(cross))]
        print('zero crossings=%d  mean period=%.4f ms  f=%.1f Hz'
              % (len(cross), 1e3 * sum(per) / len(per), 1 / (sum(per) / len(per))))

if __name__ == '__main__':
    mode, src = sys.argv[1], sys.argv[2]
    args = [a for a in sys.argv[3:] if not a.startswith('--')]
    o = {}
    for a in sys.argv[3:]:
        if a.startswith('--'):
            k, _, v = a[2:].partition('=')
            o[k] = v
    sgn = int(o.get('sgn', 1))
    POLE = o.get('pole', 'auto')
    if mode == 'tran':
        tran(src, args, o.get('tstop', '60m'), o.get('tstep', '4u'), sgn,
             float(o.get('settle', 0.6)))
    elif mode == 'ac':
        ac(src, args or ['y'], sgn, float(o.get('lo', 20)), float(o.get('hi', 20000)))
    elif mode == 'cost':
        cost(src, o.get('tstop', '100m'), o.get('tstep', '1u'), sgn, int(o.get('reps', 3)))
    elif mode == 'wave':
        wave(src, args[0], o.get('tstart', '0.3'), o.get('tstop', '400m'),
             o.get('tstep', '2u'), sgn)
    else:
        print(__doc__)
