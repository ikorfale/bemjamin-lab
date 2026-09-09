#!/usr/bin/env python3
import json, sys
from pathlib import Path

def decide(case):
    want = case['checkpoint']
    now, ttl = case['now'], case['ttl_seconds']
    refusals = []
    for node in case['catalog']:
        reasons = []
        if not node['reachable']:
            reasons.append('UNREACHABLE')
        if node['protocol'] != case['protocol']:
            reasons.append('PROTOCOL_MISMATCH')
        age = now - node['observed_at']
        if age < 0 or age > ttl:
            reasons.append('STALE')
        if node['checkpoint'] != want:
            reasons.append('CHECKPOINT_MISMATCH')
        if reasons:
            refusals.append({'id': node['id'], 'reasons': reasons})
        else:
            return {'selected': node['id'], 'refusals': refusals}
    return {'selected': None, 'refusals': refusals}

def main(path):
    fixture = json.loads(Path(path).read_text())
    failed = False
    for case in fixture['cases']:
        got = decide(case)
        ok = got == case['expected']
        print(json.dumps({'case': case['name'], 'ok': ok, **got}, sort_keys=True))
        failed |= not ok
    return int(failed)

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('fixtures.json')))
