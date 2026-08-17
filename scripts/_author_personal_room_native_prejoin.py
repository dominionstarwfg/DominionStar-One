from pathlib import Path
import hashlib
import json
import textwrap


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"required source marker missing in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Desktop Meet Home: restore Personal Room as a first-class choice.
replace_once(
    'meet-home/index.html',
    '.actions{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:17px;margin:34px 0}',
    '.actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:17px;margin:34px 0}'
)
replace_once(
    'meet-home/index.html',
    '<button class="action" data-action="join"><i>＋</i><strong>Join</strong><small>Enter a meeting ID</small></button><button class="action" data-action="schedule"><i>□</i><strong>Schedule</strong><small>Plan for later</small></button>',
    '<button class="action" data-action="join"><i>＋</i><strong>Join</strong><small>Enter a meeting ID</small></button><button class="action" data-action="personal"><i>◇</i><strong>Personal Room</strong><small>Your permanent meeting room</small></button><button class="action" data-action="schedule"><i>□</i><strong>Schedule</strong><small>Plan for later</small></button>'
)

# Hosted prejoin: every desktop getUserMedia call first crosses the native
# macOS TCC permission bridge when bridge 13 is available.
hotfix_path = Path('assets/js/meet/hotfix-rc13-1-media-prejoin.js')
hotfix = hotfix_path.read_text()
hotfix = hotfix.replace(
    "  const speakerKey = 'ds_meet_speaker_id';\n",
    "  const speakerKey = 'ds_meet_speaker_id';\n  const desktopParams = new URLSearchParams(location.search);\n  const desktopMode = desktopParams.get('desktop') === '1';\n",
    1
)
marker = "  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);\n"
permission_block = textwrap.dedent(r'''
  const nativePermissionBlocked = value => ['denied', 'restricted'].includes(String(value || '').toLowerCase());
  const ensureNativeMediaPermissions = async constraints => {
    if (!desktopMode || !window.dominionDesktop?.getMediaPermissions) return true;
    const kinds = [];
    if (constraints?.video) kinds.push('camera');
    if (constraints?.audio) kinds.push('microphone');
    if (!kinds.length) return true;

    let status = await window.dominionDesktop.getMediaPermissions().catch(() => null);
    if (!status?.ok) return true;
    const undetermined = kinds.filter(kind => String(status?.[kind] || '').toLowerCase() === 'not-determined');
    if (undetermined.length && window.dominionDesktop?.requestMediaPermissions) {
      status = await window.dominionDesktop.requestMediaPermissions(undetermined).catch(() => status);
    }
    const blocked = kinds.filter(kind => nativePermissionBlocked(status?.[kind]));
    if (!blocked.length) return true;

    const names = blocked.map(kind => kind === 'camera' ? 'Camera' : 'Microphone').join(' and ');
    const error = new Error(`DominionStar Meet needs macOS ${names} permission. Open System Settings > Privacy & Security, allow DominionStar Meet, then reopen the app.`);
    error.name = 'NotAllowedError';
    error.permissionKinds = blocked;
    throw error;
  };

''').lstrip('\n')
if marker not in hotfix:
    raise SystemExit('original getUserMedia marker missing')
hotfix = hotfix.replace(marker, permission_block + marker, 1)
hotfix = hotfix.replace(
    '    navigator.mediaDevices.getUserMedia = constraints => {',
    '    navigator.mediaDevices.getUserMedia = async constraints => {',
    1
)
hotfix = hotfix.replace(
    '      return originalGetUserMedia(next);\n',
    '      await ensureNativeMediaPermissions(next);\n      return originalGetUserMedia(next);\n',
    1
)
hotfix = hotfix.replace(
    "    } catch (_) {\n      setPreviewVisualState({videoOn:false,audioOn:false});\n    }\n  };\n\n  const enterHostPrejoin",
    "    } catch (error) {\n      setPreviewVisualState({videoOn:false,audioOn:false});\n      const status = $('joinStatus');\n      if (status && error?.message) {\n        status.textContent = error.message;\n        status.hidden = false;\n      }\n    }\n  };\n\n  const enterHostPrejoin",
    1
)
expose_marker = "    startHotfixPreview().catch(() => {});\n  };\n\n  // Desktop Meet Home arrives"
if expose_marker not in hotfix:
    raise SystemExit('enterHostPrejoin exposure marker missing')
hotfix = hotfix.replace(
    expose_marker,
    "    startHotfixPreview().catch(() => {});\n  };\n\n  window.DominionStarEnterHostPrejoin = options => enterHostPrejoin(options || {});\n\n  // Desktop Meet Home arrives",
    1
)
bootstrap_marker = "  if (bootstrapParams.get('desktop') === '1' && (bootstrapAction === 'new' || bootstrapAction === 'share')) {\n    enterHostPrejoin({autoShare:bootstrapAction === 'share'});\n    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.1-desktop-prejoin-v2';\n  }\n\n  document.addEventListener('click', event => {"
if bootstrap_marker not in hotfix:
    raise SystemExit('desktop bootstrap marker missing')
hotfix = hotfix.replace(
    bootstrap_marker,
    "  if (bootstrapParams.get('desktop') === '1' && (bootstrapAction === 'new' || bootstrapAction === 'share')) {\n    enterHostPrejoin({autoShare:bootstrapAction === 'share'});\n    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.1-desktop-prejoin-v2';\n  }\n  if (bootstrapParams.get('desktop') === '1' && bootstrapAction === 'personal') {\n    const openPersonalRoom = () => setTimeout(() => $('personalMeetingAction')?.click(), 0);\n    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openPersonalRoom, {once:true});\n    else openPersonalRoom();\n    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.2-desktop-personal-room';\n  }\n\n  document.addEventListener('click', event => {",
    1
)
hotfix = hotfix.replace(
    "  window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.1-media-prejoin-local-devices';",
    "  window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.2-native-permissions-personal-room';",
    1
)
hotfix_path.write_text(hotfix)

# Personal Room keeps its existing account/local persistence, but Start now
# stops at shared host prejoin instead of entering immediately.
personal_path = Path('assets/js/meet-next/personal-room.js')
personal = personal_path.read_text()
personal_marker = "    $('personalRoomDialog')?.close();\n    const form = $('joinForm');"
if personal_marker not in personal:
    raise SystemExit('Personal Room start marker missing')
personal = personal.replace(
    personal_marker,
    "    $('personalRoomDialog')?.close();\n    if (typeof window.DominionStarEnterHostPrejoin === 'function') {\n      window.DominionStarEnterHostPrejoin({\n        room: value.personalRoomId,\n        passcode: value.passcode,\n        waitingRoom: value.waitingRoomEnabled,\n        autoShare: false\n      });\n      return;\n    }\n    const form = $('joinForm');",
    1
)
personal_path.write_text(personal)

# Cache-bust the changed hosted controllers.
replace_once('meet/index.html', '/assets/js/meet-next/personal-room.js?v=1', '/assets/js/meet-next/personal-room.js?v=2-native-prejoin')
replace_once('meet/index.html', '/assets/js/meet/hotfix-rc13-1-media-prejoin.js?v=2-desktop-bootstrap', '/assets/js/meet/hotfix-rc13-1-media-prejoin.js?v=3-native-permission-personal')

# Deterministic regression test.
Path('scripts/test-personal-room-native-prejoin.mjs').write_text(textwrap.dedent(r'''
import fs from 'node:fs';
import crypto from 'node:crypto';

const home = fs.readFileSync('meet-home/index.html', 'utf8');
const meet = fs.readFileSync('meet/index.html', 'utf8');
const hotfix = fs.readFileSync('assets/js/meet/hotfix-rc13-1-media-prejoin.js', 'utf8');
const personal = fs.readFileSync('assets/js/meet-next/personal-room.js', 'utf8');
const preload = fs.readFileSync('desktop 2/src/preload.cjs', 'utf8');
const main = fs.readFileSync('desktop 2/src/main-v2.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('meet/release-contract.json', 'utf8'));

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(home.includes('data-action="personal"'), 'Desktop Meet Home must expose Personal Room');
assert(home.includes('Your permanent meeting room'), 'Personal Room must be clearly identified as permanent');
assert(hotfix.includes("bootstrapAction === 'personal'"), 'Desktop Personal Room bootstrap is missing');
assert(hotfix.includes('window.DominionStarEnterHostPrejoin'), 'Shared host prejoin hook is missing');
assert(hotfix.includes('getMediaPermissions'), 'Hosted prejoin does not query native media permission state');
assert(hotfix.includes('requestMediaPermissions'), 'Hosted prejoin does not request native macOS permission');
assert(hotfix.includes('await ensureNativeMediaPermissions(next)'), 'Every wrapped getUserMedia request must cross native permission gate');
assert(personal.includes('window.DominionStarEnterHostPrejoin'), 'Personal Room Start must route through shared prejoin');
assert(preload.includes('getMediaPermissions: () =>'), 'Desktop bridge media permission status API missing');
assert(preload.includes('requestMediaPermissions:'), 'Desktop bridge media permission request API missing');
assert(preload.includes('const BRIDGE_VERSION = 13'), 'Desktop bridge 13 is required for native media permission support');
assert(main.includes("systemPreferences.askForMediaAccess(kind)"), 'macOS native permission request is missing');
assert(meet.includes('personal-room.js?v=2-native-prejoin'), 'Personal Room cache-bust missing');
assert(meet.includes('hotfix-rc13-1-media-prejoin.js?v=3-native-permission-personal'), 'Native prejoin cache-bust missing');

for (const path of ['meet-home/index.html','meet/index.html','assets/js/meet-next/personal-room.js','assets/js/meet/hotfix-rc13-1-media-prejoin.js']) {
  assert(contract.files?.[path], `Release contract is missing ${path}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert(contract.files[path] === actual, `Release contract hash mismatch for ${path}`);
}
console.log('Personal Room + native desktop prejoin regression passed.');
''').lstrip('\n'))

# Pin exact changed hosted bytes in the existing release contract.
contract_path = Path('meet/release-contract.json')
contract = json.loads(contract_path.read_text())
changed = [
    'meet-home/index.html',
    'meet/index.html',
    'assets/js/meet-next/personal-room.js',
    'assets/js/meet/hotfix-rc13-1-media-prejoin.js'
]
for path in changed:
    if path not in contract.get('files', {}):
        raise SystemExit(f'release contract is missing protected path {path}')
    contract['files'][path] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
contract_path.write_text(json.dumps(contract, indent=2) + '\n')

# Make the regression a required Meet Runtime gate.
workflow = Path('.github/workflows/meet-runtime-verify.yml')
runtime = workflow.read_text()
anchor = '      - name: Desktop prejoin bootstrap\n        run: node scripts/test-desktop-prejoin-bootstrap.mjs\n'
addition = anchor + '      - name: Personal Room + native desktop prejoin\n        run: node scripts/test-personal-room-native-prejoin.mjs\n'
if anchor not in runtime:
    raise SystemExit('Meet Runtime desktop prejoin gate marker missing')
workflow.write_text(runtime.replace(anchor, addition, 1))
