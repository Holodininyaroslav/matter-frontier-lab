import io
import urllib.parse
import pytest
from scientific_backend import biomolecule_adapter as bio


@pytest.mark.parametrize('url', [
    'https://files.rcsb.org/download/1CRN.pdb;open /tmp/script.py',
    'https://files.rcsb.org/download/1CRN.pdb%3bexit',
    'https://files.rcsb.org/download/1CRN.pdb?command=exit',
    'https://files.rcsb.org/download/1CRN.pdb#exit',
    'https://files.rcsb.org@evil.invalid/download/1CRN.pdb',
    'https://files.rcsb.org:443/download/1CRN.pdb',
    'file:///tmp/model.pdb',
    'https://alphafold.ebi.ac.uk/files/script.py',
    'https://files.rcsb.org/download/1CRN.pdb\nexit',
])
def test_command_language_cannot_enter_bridge(url, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail('Invalid URL reached native bridge/network')
    monkeypatch.setattr(bio, '_chimerax_bridge_status', forbidden)
    monkeypatch.setattr(bio.urllib.request, 'urlopen', forbidden)
    with pytest.raises(ValueError):
        bio._chimerax_open(url)


def test_canonical_url_is_quoted(monkeypatch):
    monkeypatch.setattr(bio, '_chimerax_bridge_status', lambda: {'available': True})
    calls=[]
    def response(url, **kwargs):
        calls.append(url)
        return io.BytesIO(b'ok')
    monkeypatch.setattr(bio.urllib.request, 'urlopen', response)
    assert bio._chimerax_open('https://files.rcsb.org/download/1crn.pdb')['opened']
    command=urllib.parse.parse_qs(urllib.parse.urlsplit(calls[0]).query)['command'][0]
    assert command == 'open "https://files.rcsb.org/download/1CRN.pdb"'
