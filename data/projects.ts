/**
 * Curated catalogue of Basic Automation's public software.
 *
 * This is the editorial layer: the pitch, the feature copy, the code that
 * actually shows what a project feels like to use. Everything that moves on
 * its own — stars, versions, downloads, READMEs — is fetched live from GitHub
 * and crates.io at request time (see server/utils/github.ts).
 *
 * To add a project: add an entry here, drop a logo in public/projects/ if it
 * has one, then run `npm run sync` to refresh the offline fallback snapshot.
 *
 * COPY RULE: this is a sales page, not documentation. Every line here answers
 * "what do I get?" — the outcome, the time saved, the problem that goes away.
 * Implementation detail (crate names, traits, protocols, internal types) belongs
 * in the project's GitHub README, which is one click away and rendered further
 * down the page anyway. If a sentence would only land with someone who already
 * uses the library, it is in the wrong file.
 */

/** A key in the Paleday Tailwind palette, used to tint a project's page. */
export type Accent = 'magenta' | 'cyan' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'

export type Status = 'stable' | 'active' | 'alpha' | 'archived'

export interface Feature {
  /** Three or four words, sentence case */
  title: string
  /** One or two sentences saying what it means for the person using it */
  body: string
}

export interface CodeSample {
  /** Shown above the block, e.g. "src/main.rs" or "Cargo.toml" */
  label: string
  /** Grammar for the syntax highlighter; omit for plain text */
  lang?: string
  code: string
}

export interface Project {
  /** URL segment: /projects/<slug> */
  slug: string
  /** Repository name under github.com/basic-automation */
  repo: string
  /** Display name */
  name: string
  /** Wordmark in public/projects/, shown instead of the name in the page hero */
  logo?: string
  /** Screenshot in public/projects/shots/, shown on the card and the page */
  screenshot?: string
  /** What the screenshot shows, for its `alt`. Without one it is "<name> screenshot",
   *  which tells a screen reader nothing the heading has not already said. */
  screenshotAlt?: string
  /** This project serves basicautomation.io itself — show the site's own
   *  onion address on its page, as evidence rather than as a claim */
  servesThisSite?: boolean
  /** Show the live Tor frame and the Tor Browser walkthrough on this page.
   *  Implied by `servesThisSite`; set it directly for a project that is about
   *  reaching a page over Tor rather than about publishing one. */
  showsTorDemo?: boolean
  /** One line, sentence case, no trailing period — cards, lists and <title> */
  tagline: string
  /** The headline claim. Short, declarative, the one thing to remember. */
  hero: string
  /** Two or three sentences for the lede and the meta description */
  summary: string
  /** Why it exists — the problem, stated plainly, before any feature list */
  problem: string
  /** Short kind-of-thing label, e.g. "Rust crate" */
  kind: string
  status: Status
  accent: Accent
  /** Sort order on the landing page; lower is first */
  order: number
  /** The marketing body: what it does, in terms of what you get */
  features: Feature[]
  /** Optional one-liner to get started */
  install?: CodeSample
  /** Optional worked example — the strongest argument most libraries have */
  example?: CodeSample
  /** crates.io crate name, when the project is published there */
  crate?: string
  /** Extra links beyond GitHub/crates.io/docs.rs */
  links?: { label: string, href: string }[]
}

export const projects: Project[] = [
  {
    slug: 'artiqwest',
    repo: 'artiqwest',
    name: 'artiqwest',
    logo: '/projects/artiqwest.svg',
    showsTorDemo: true,
    tagline: 'Private web requests for your app, without the setup',
    hero: 'Every request, through Tor.',
    summary:
      'Send your application\'s web traffic through the Tor network with a single line of '
      + 'code. There is nothing to install beside it and nothing to configure — the privacy '
      + 'layer is built in, and your code looks the way it always did.',
    problem:
      'Routing an application through Tor normally means running a second service next to it, '
      + 'wiring a proxy into your code, and keeping the two in step forever. That is a week of '
      + 'work and a permanent piece of infrastructure to maintain. artiqwest removes the whole '
      + 'layer: you make a request, and it goes out over Tor.',
    kind: 'Rust library',
    status: 'stable',
    accent: 'magenta',
    order: 1,
    features: [
      {
        title: 'Nothing to install beside it',
        body: 'The privacy layer is compiled into your program. No second service to deploy, supervise, or explain to whoever runs your servers.',
      },
      {
        title: 'Three calls to learn',
        body: 'Fetch, send, and stay connected. That is the whole thing — no client to set up and pass around, no configuration to get wrong.',
      },
      {
        title: 'Live connections too',
        body: 'Real-time two-way connections work the same way, to private services and the open web alike.',
      },
      {
        title: 'Recovers on its own',
        body: 'Connections drop; the network reroutes. It rebuilds quietly and retries before your code ever sees a failure.',
      },
      {
        title: 'Out of your way while you build',
        body: 'Local requests skip the network entirely, so your development loop stays as fast as it was before.',
      },
      {
        title: 'Free, and yours to audit',
        body: 'MIT licensed, open source, and already used in production. Read every line before you ship it.',
      },
    ],
    install: { label: 'add it to your project', lang: 'shellscript', code: 'cargo add artiqwest' },
    example: {
      label: 'the whole integration',
      lang: 'rust',
      code: `use artiqwest::{get, post};

#[tokio::main]
async fn main() {
    // An ordinary website — fetched privately.
    let response = get("https://httpbin.org/get", None, None).await.unwrap();
    assert_eq!(response.status(), 200);

    // A private service, with headers, exactly as you would expect.
    let body = r#"{"test": "testing"}"#;
    let headers = vec![("Content-Type", "application/json")];
    let response = post("http://example.onion/echo", body, Some(headers), None)
        .await
        .unwrap();
    assert_eq!(response.to_string(), body);
}`,
    },
    crate: 'artiqwest',
  },
  {
    slug: 'onyums',
    repo: 'onyums',
    name: 'onyums',
    logo: '/projects/onyums.svg',
    servesThisSite: true,
    tagline: 'Publish a private web service, protected from the first minute',
    hero: 'Your app, reachable only through Tor.',
    summary:
      'Put a web service online so that only people you share the address with can reach it — '
      + 'with the encryption, certificates and abuse protection already switched on. No server '
      + 'to rent, no ports to open, no security stack to assemble yourself.',
    problem:
      'Publishing a private service is normally an assembly job: a privacy service, certificates, '
      + 'a proxy in front, rate limiting, and a long list of ways to get it quietly wrong. The '
      + 'parts that protect you are the ones easiest to forget. Onyums ships assembled and '
      + 'hardened — you turn protections off when you have a reason to, instead of finding out '
      + 'later which ones you never turned on.',
    kind: 'Rust library',
    status: 'stable',
    accent: 'cyan',
    order: 2,
    features: [
      {
        title: 'Protected the moment it starts',
        body: 'Encryption, certificates and abuse defense are on before you write a line of configuration. The safe setup is the default one.',
      },
      {
        title: 'No server to rent',
        body: 'It runs from a machine you already have. No hosting bill, no public address, no provider holding your service.',
      },
      {
        title: 'Nothing to open on your network',
        body: 'Connections go out, never in. No port forwarding, no static IP, no firewall exception, no conversation with IT.',
      },
      {
        title: 'Bad traffic stopped at the door',
        body: 'Abuse protection runs before a request ever reaches your code, so a flood costs you nothing but the refusal.',
      },
      {
        title: 'Keep the app you already wrote',
        body: 'Hand it your existing web service and it publishes that. Nothing to port, nothing to rewrite.',
      },
      {
        title: 'The address stays the same',
        body: 'Restart the machine, move it to another one — the address you gave people keeps working.',
      },
    ],
    install: { label: 'add it to your project', lang: 'shellscript', code: 'cargo add onyums tokio --features tokio/full' },
    example: {
      label: 'a complete, private web service',
      lang: 'rust',
      code: `use onyums::{OnionService, routing::get, Router};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new().route("/", get(|| async { "Hello from Tor!" }));

    let handle = OnionService::builder()
        .router(app)
        .nickname("my_onion")
        .serve()
        .await?;

    // Share this address with whoever should reach the service.
    println!("serving on https://{}", handle.onion_address());

    handle.ready().await;
    tokio::signal::ctrl_c().await?;
    handle.shutdown().await;
    Ok(())
}`,
    },
    crate: 'onyums',
  },
  {
    slug: 'weftdb',
    repo: 'weftdb',
    name: 'WeftDB',
    logo: '/projects/weftdb.svg',
    tagline: 'A time-series database for data that never arrived on schedule',
    hero: 'Gaps, filled. And labelled.',
    summary:
      'A database for readings that come in irregularly — sensors that drop out, '
      + 'markets that trade in bursts, devices that batch-upload after hours offline. '
      + 'Ask for any resolution and it returns a continuous series, with every point '
      + 'marked as observed or reconstructed.',
    problem:
      'Most time-series databases assume the readings arrive on a clean, regular beat. '
      + 'Real ones do not. Ask for a value between two samples and you get a gap, a null '
      + 'or a zero — and the job of rebuilding the signal lands back in your own code, '
      + 'written slightly differently in every place that needs it. WeftDB does that '
      + 'reconstruction where the data already is, and tells you which numbers it made up.',
    kind: 'Database',
    status: 'alpha',
    accent: 'red',
    order: 3,
    features: [
      {
        title: 'Ask for any resolution',
        body: 'Want it per second when the readings came every few minutes? Ask. You get a continuous series back, not a list of holes to patch yourself.',
      },
      {
        title: 'Made-up numbers say so',
        body: 'Every point is marked observed, interpolated or extrapolated. You can filter or refuse reconstructed values deliberately, rather than discovering one in a report later.',
      },
      {
        title: 'Precision you declare, not hope for',
        body: 'You state the accuracy each measurement needs. A value that cannot be stored within it is rejected outright instead of quietly rounded — the difference between books you can audit and books you cannot.',
      },
      {
        title: 'The work happens next to the data',
        body: 'Resampling and gap-filling run inside the database rather than in a loop on your machine pulling raw rows across the network. Less waiting, less code to maintain.',
      },
      {
        title: 'Three ways in',
        body: 'An HTTP API for anything that speaks JSON, a Rust library if you want it embedded, and a terminal interface for looking around.',
      },
      {
        title: 'Every claim has a benchmark',
        body: 'Performance numbers come with the benchmark that produced them, and you can run it yourself. Over a thousand tests pass; the storage format is checksummed and versioned.',
      },
    ],
    example: {
      label: 'two readings a minute apart, returned as sixty-one',
      lang: 'shellscript',
      code: `curl -s -X POST http://127.0.0.1:8080/api/v1/interpolate \\
  -H 'content-type: application/json' \\
  -d '{"spline":"linear","resolution":"seconds",
       "points":[{"timestamp":"1970-01-01T00:00:00Z","value":0.0},
                 {"timestamp":"1970-01-01T00:01:00Z","value":60.0}]}'

# The two you gave it come back marked "raw".
# The fifty-nine between them come back marked "interpolated".`,
    },
  },
  {
    slug: 'enlil',
    repo: 'enlil',
    name: 'Enlil',
    logo: '/projects/enlil.svg',
    tagline: 'Several separate computers on one desktop, without touching what you have',
    hero: 'One machine. Several real PCs.',
    summary:
      'Run several independent computers on a single desktop — each with its own processors, '
      + 'memory and hardware, each behaving like a machine of its own. It starts from a USB '
      + 'stick and leaves everything already on your drives exactly as it was.',
    problem:
      'Trying this normally means committing first: repartition the drive, replace how the '
      + 'machine starts, rebuild your setup, and find out afterwards whether it was worth it. '
      + 'Enlil runs from a USB stick. Pull it out, restart, and your computer is precisely as '
      + 'you left it.',
    kind: 'Operating software',
    status: 'alpha',
    accent: 'yellow',
    order: 4,
    features: [
      {
        title: 'Try it, lose nothing',
        body: 'It starts from a USB stick and never writes to your drives. The cost of finding out whether it suits you is one restart.',
      },
      {
        title: 'Each one feels like its own machine',
        body: 'Every computer gets its own processors and memory and sees hardware that looks real to it — including software that normally refuses to run in a virtual machine.',
      },
      {
        title: 'Your hardware where you want it',
        body: 'Send a particular graphics card, drive, or USB device to a particular machine. No fighting over who gets what.',
      },
      {
        title: 'One desk, two workstations',
        body: 'A Windows machine and a Linux machine on the same box at the same time, each with real performance, neither aware of the other.',
      },
      {
        title: 'Built toward shared hardware',
        body: 'The long aim is machines that draw their processors, memory and graphics from a pool of computers rather than one box — so capacity is something you allocate, not something you buy twice.',
      },
      {
        title: 'Early, open, and honest about it',
        body: 'Pre-1.0 research software under an MIT license. Worth watching and worth testing — not yet worth trusting with anything you cannot lose.',
      },
    ],
    links: [{ label: 'Security notes', href: 'https://github.com/basic-automation/enlil/blob/master/SECURITY.md' }],
  },
  {
    slug: 'nisaba',
    repo: 'nisaba',
    name: 'Nisaba',
    logo: '/projects/nisaba.svg',
    tagline: 'One product list that keeps every storefront you sell on in step',
    hero: 'One catalog. Every marketplace.',
    summary:
      'Keep a single product list and let it publish everywhere you sell. Prices, descriptions '
      + 'and stock levels stay in step across eBay, Squarespace, XMR Bazaar and Amazon, so a '
      + 'sale in one place is reflected in all of them.',
    problem:
      'Selling the same products in four places means keeping four product lists, and every sale '
      + 'quietly pulls them apart. You find out at the worst moment — when something sells twice '
      + 'and you only have one. Nisaba keeps one list, on your own computer, and brings the '
      + 'storefronts back to it.',
    kind: 'Desktop app',
    status: 'active',
    accent: 'blue',
    order: 5,
    features: [
      {
        title: 'Sell in four places, maintain one list',
        body: 'Edit a price or a description once. Every storefront that carries the product picks up the change on the next sync.',
      },
      {
        title: 'Stock that stays honest',
        body: 'A sale anywhere counts down everywhere, so you stop selling things you no longer have.',
      },
      {
        title: 'See the sync before it runs',
        body: 'A dry run resolves a whole cycle and reports every change it would make — to your storefronts and to your own records — before anything is written.',
      },
      {
        title: 'Supplier catalogs, imported',
        body: 'Pull product lists, options and dealer pricing straight from your suppliers instead of retyping them.',
      },
      {
        title: 'Your business stays on your machine',
        body: 'The catalog lives on your computer, not someone else\'s server, and your storefront logins sit in the keychain your operating system already protects.',
      },
      {
        title: 'Two locations, one catalog',
        body: 'Run it in more than one place and keep them in step directly — no service in the middle, no subscription to hold your inventory hostage.',
      },
      {
        title: 'Know what actually sells',
        body: 'History and trends per product, so restocking is a decision rather than a guess.',
      },
    ],
    install: {
      label: 'no binaries yet — build it from source',
      lang: 'shellscript',
      code: 'cargo tauri build',
    },
    // The real worked example for a desktop app is not code you write, it is
    // the one file you fill in before it can reach a storefront. Taken from
    // the repo's own config.example.toml.
    example: {
      label: 'connecting your storefronts',
      lang: 'toml',
      code: `[general]
sync_schedule = "0 */5 * * * *"    # every five minutes
max_retries = 3

[ebay]
enabled = true
client_id = ""
client_secret = ""
environment = "production"

[squarespace]
enabled = true
api_key = ""

[alerts]
default_low_stock_threshold = 5    # overridable per product in the app

# Products are not configured here. They live in the catalog on your machine,
# and you edit them in the app.`,
    },
    links: [{ label: 'Built with Tauri', href: 'https://v2.tauri.app' }],
  },
  {
    slug: 'skidbladnir',
    repo: 'Skidbladnir',
    name: 'Skidbladnir',
    logo: '/projects/skidbladnir.svg',
    screenshot: '/projects/shots/skidbladnir-screenshot.webp',
    screenshotAlt:
      'The Skidbladnir window with WebP selected: the format rail with WebP, AVIF, JPEG XL '
      + 'and HEIC, and cwebp\'s options as controls, each labelled with the flag it sets: '
      + 'compression, transparency and lossy tuning',
    tagline: 'Smaller images, in every modern format, without touching a command line',
    hero: 'Every modern image format, in one window.',
    summary:
      'Convert images to WebP, AVIF, JPEG XL or HEIC through a window instead of a command '
      + 'line — every option each encoder has for a still image, not just a quality slider. '
      + 'See the result beside the original before anything is written, then convert a batch '
      + 'or a whole folder. Windows and Linux, with an experimental macOS build.',
    problem:
      'The reference encoders are excellent and almost unusable: four separate command-line '
      + 'tools, each a wall of options you relearn every time you need them, each one wrong '
      + 'flag away from a ruined batch. Skidbladnir puts a window in front of all four and, '
      + 'for a still image, gets the same files out.',
    kind: 'Desktop app',
    status: 'active',
    accent: 'green',
    order: 6,
    features: [
      {
        title: 'Four formats, one window',
        body: 'WebP, AVIF, JPEG XL and HEIC, each with its own controls. Convert between any of them, and each format remembers its own settings while you try another.',
      },
      // The claim is scoped on purpose, the way the README scopes it: still
      // images, the four named tools, and its exceptions one click away. Never
      // widen it to "anything the command line can do", and never type a case
      // count here — the count moves with every release and is the README's to
      // state.
      {
        title: 'The same files as the official tools',
        body: 'For a still image, every option of cwebp, avifenc (with libaom), cjxl and heif-enc (with Kvazaar) is a control here, labelled with the flag it sets, and Skidbladnir writes the same bytes those tools write, checked against the real tools on every change. The exceptions are listed in the readme below.',
      },
      {
        title: 'See it before you write it',
        body: 'Preview the encoded result beside your original, with the size and the saving, before anything touches your disk.',
      },
      {
        title: 'JPEGs about a fifth smaller, losslessly',
        body: 'JPEG XL repacks a JPEG typically about 20% smaller without decoding it (libjxl\'s own figure), and the original can be rebuilt from it exactly. Nothing is thrown away and nothing is guessed.',
      },
      {
        title: 'iPhone photos in, any modern format out',
        body: 'Reads HEIC, AVIF, JPEG XL, WebP, PNG, JPEG, TIFF, GIF, PNM/PAM and PFM — including the CMYK JPEGs Photoshop writes and the official WebP tool refuses — and works out which is which by looking inside the file rather than trusting its name. An animated GIF or WebP comes out as an animated WebP, every frame kept.',
      },
      {
        title: 'A batch, or a whole folder',
        body: 'Queue files or point it at a directory, with subfolders if you want them. Progress per file, and a Cancel that never leaves a half-written image behind.',
      },
      {
        title: 'Expert dials, out of the way',
        body: 'Noise shaping, filter strength, multi-pass, sharp colour conversion, segment count — every option the encoders have for a still image, folded behind a disclosure so the simple path stays simple. Save the settings you settle on as named presets.',
      },
      {
        title: 'Two editions, one app',
        body: 'The standard edition writes HEIC with Kvazaar. The GPL edition uses x265 instead, which adds its lossless mode, 4:4:4 and 4:2:2 chroma, and 10-bit HEIC. Everything else is the same and both are free; if you are not sure, take the standard one.',
      },
      {
        title: 'Honest about where it is',
        body: 'Stable since 1.0. On every change, CI installs the standard edition on Windows and drives it, and launches and drives the Linux app. macOS is experimental: built and launched in CI, not yet tried by a person on a real Mac. Nothing is code-signed yet. It updates itself, checking each release against the project\'s signing key before installing it.',
      },
    ],
    // The argument for a GUI over a CLI is the command line it replaces, so
    // show it. Every flag here is one the app exposes in its own window — and
    // this is only the WebP one; there is a separate tool, with its own flags,
    // behind each of the other three formats. Deliberately still `cwebp`: it is
    // the line this project has always been measured against, and the one whose
    // output the app matches byte for byte.
    example: {
      label: 'one of the four command lines you no longer have to remember',
      lang: 'shellscript',
      code: `cwebp -q 80 -m 6 -sharp_yuv -sns 80 -f 60 -segments 4 \\
      -mt -resize 1600 0 \\
      hero-banner.png -o hero-banner.webp`,
    },
    links: [
      {
        // `/releases/latest` names the newest stable release. Before the first
        // one, GitHub answers it with the full release list, so it is never a
        // dead link.
        label: 'Download (Windows, Linux; macOS experimental)',
        href: 'https://github.com/basic-automation/Skidbladnir/releases/latest',
      },
      { label: 'Built with Tauri', href: 'https://v2.tauri.app' },
    ],
  },
  {
    slug: 'nanna',
    repo: 'Nanna',
    name: 'Nanna',
    logo: '/projects/nanna.svg',
    tagline: 'An assistant that lives on your own hardware and remembers you',
    hero: 'Your assistant, on your machine.',
    summary:
      'A personal assistant that runs on a computer you own instead of someone else\'s. It stays '
      + 'on, it remembers what you told it last week, and it reaches you wherever you already are '
      + '— Telegram, Discord, Slack, Signal or WhatsApp. No account, no subscription.',
    problem:
      'The assistants that know you best are the ones that keep everything they know on a server '
      + 'you do not control, and forget you the moment the tab closes. Nanna runs as a service on '
      + 'your own machine and thinks with an open model on a single consumer GPU, so the private '
      + 'part is not a setting you have to trust — there is nowhere else for it to go.',
    kind: 'Personal AI',
    status: 'active',
    accent: 'orange',
    order: 7,
    features: [
      {
        title: 'It is already running',
        body: 'Nanna sits in the background as a service rather than waiting for you to open something. Ask it at midnight and it is there.',
      },
      {
        title: 'It remembers between conversations',
        body: 'What you told it last week is still true this week, across every channel you talk to it on. You stop re-explaining yourself.',
      },
      {
        title: 'Message it from anywhere',
        body: 'Telegram, Discord, Slack, Signal and WhatsApp. Text it from your phone on the train and the answer comes from the machine at home.',
      },
      {
        title: 'The cloud is optional',
        body: 'A small open model on one consumer GPU is enough to run it entirely on your own hardware. Add an Anthropic, OpenAI or OpenRouter key only if you want one.',
      },
      {
        title: 'It does things, not just talks',
        body: 'Forty-seven tools are wired in out of the box, and it picks up more from any MCP server you point it at — your files, your notes, your own systems.',
      },
      {
        title: 'Nothing leaves without a reason',
        body: 'Credentials live in the keychain your operating system already protects, and every inbound webhook is refused unless it proves who sent it.',
      },
      {
        title: 'It keeps itself current',
        body: 'New versions install in place, so the thing running quietly in the background does not quietly fall behind.',
      },
    ],
    install: {
      label: 'the one prerequisite — then the installer from Releases',
      lang: 'shellscript',
      code: 'ollama pull qwen3.5:9b',
    },
    // Same reasoning as Nisaba: the worked example for something you run rather
    // than import is the one file you fill in. Trimmed from the README's own
    // config.toml.
    example: {
      label: 'config.toml',
      lang: 'toml',
      code: `[llm]
provider = "ollama"       # ollama | anthropic | openai | openrouter
model = "qwen3.5:9b"      # a fully local run needs no key at all

[server]
port = 3000

[[mcp.servers]]           # give it your notes; its tools appear alongside the built-ins
name = "files"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/notes"]

# Channel tokens are not kept here. They go in the operating system keyring,
# and this file only records that the channel is switched on.`,
    },
    links: [
      { label: 'Built with Tauri', href: 'https://v2.tauri.app' },
      { label: 'Needs Ollama', href: 'https://ollama.com' },
      {
        label: 'Download for Windows',
        href: 'https://github.com/basic-automation/Nanna/releases',
      },
    ],
  },
]

/** Repos deliberately left off the site (this site's own repo, the old page). */
export const excludedRepos = ['basic-automation.github.io', 'basicautomation.io']

export const bySlug = (slug: string): Project | undefined =>
  projects.find((p) => p.slug === slug)

export const sortedProjects = (): Project[] =>
  [...projects].sort((a, b) => a.order - b.order)
