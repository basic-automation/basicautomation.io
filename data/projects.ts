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
    order: 3,
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
    order: 4,
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
    tagline: 'Smaller images for the web, without touching a command line',
    hero: 'The whole WebP encoder, in a window.',
    summary:
      'Convert images to WebP through a window instead of a command line — the encoder\'s full '
      + 'control surface, not just a quality slider. Queue a batch, set it up once, and get '
      + 'exactly what the reference tool produces. Windows today; a rewrite for Linux and '
      + 'macOS is in progress.',
    problem:
      'The official WebP converter is excellent and almost unusable — a wall of options you '
      + 'relearn every time you need them, and one wrong flag away from a ruined batch. '
      + 'Skidbladnir puts a window in front of it and gets the same result.',
    kind: 'Desktop app',
    status: 'active',
    accent: 'green',
    order: 5,
    features: [
      {
        title: 'A batch at a time',
        body: 'Queue up a whole set of images and convert them in one go. It reports the original and the converted size for each one, so you can see what you actually saved.',
      },
      {
        title: 'Lighter pages, same picture',
        body: 'WebP carries the same image in a fraction of the file size — faster pages for your visitors, less bandwidth on your bill.',
      },
      {
        title: 'Aim at a size, not a number',
        body: 'Ask for a target file size or a target quality score and let the encoder find the settings, instead of guessing at a quality slider.',
      },
      {
        title: 'The reference encoder\'s output',
        body: 'It drives Google\'s own converter rather than reimplementing it, so what comes out is what the reference tool produces.',
      },
      {
        title: 'Expert dials, out of the way',
        body: 'Noise shaping, filter strength, multi-pass, sharp colour conversion, segment count — every control the encoder has, folded behind a disclosure so the simple path stays simple.',
      },
      {
        title: 'Presets for the usual jobs',
        body: 'Photo, drawing, icon, text: pick the kind of image you have and start from settings that already suit it.',
      },
    ],
    // The argument for a GUI over a CLI is the command line it replaces, so
    // show it. Every flag here is one the app exposes in its own window.
    example: {
      label: 'the command line you no longer have to remember',
      lang: 'shellscript',
      code: `cwebp -q 80 -m 6 -sharp_yuv -sns 80 -f 60 -segments 4 \\
      -mt -resize 1600 0 \\
      hero-banner.png -o hero-banner.webp`,
    },
    links: [
      {
        label: 'Download for Windows',
        href: 'https://github.com/basic-automation/Skidbladnir/releases',
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
