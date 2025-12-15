/**
 * Waiting content for interview thinking states (webview version)
 * Shows jokes or HN stories while Claude is processing
 */

// Clean programming/dad jokes (MIT licensed from official_joke_api)
const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
    "Why do Java programmers wear glasses? Because they don't C#.",
    "How many programmers does it take to change a lightbulb? None, that's a hardware problem.",
    "There are only 10 types of people in this world: those who understand binary and those who don't.",
    "Why did the programmer quit his job? Because he didn't get arrays.",
    "To understand what recursion is, you must first understand what recursion is.",
    "A user interface is like a joke. If you have to explain it, it's not that good.",
    "What's the object-oriented way to become wealthy? Inheritance.",
    "Why do C# and Java developers keep breaking their keyboards? Because they use a strongly typed language.",
    "What do you call a computer that sings? A-Dell.",
    "How do you check if a webpage is HTML5? Try it out on Internet Explorer.",
    "['hip', 'hip'] — Hip hip array!",
    "I was gonna tell you a joke about UDP... but you might not get it.",
    "The punchline often arrives before the setup. Do you know the problem with UDP jokes?",
    "What's the best thing about a Boolean? Even if you're wrong, you're only off by a bit.",
    "Where do programmers like to hangout? The Foo Bar.",
    "Which song would an exception sing? Can't catch me - Avicii",
    "Knock knock. Race condition. Who's there?",
    "What's the best part about TCP jokes? I get to keep telling them until you get them.",
    "A programmer puts two glasses on his bedside table before going to sleep. A full one, in case he gets thirsty, and an empty one, in case he doesn't.",
    "What did the router say to the doctor? It hurts when IP.",
    "An IPv6 packet is walking out of the house. He goes nowhere.",
    "A DHCP packet walks into a bar and asks for a beer. Bartender says, 'here, but I'll need that back in an hour!'",
    "3 SQL statements walk into a NoSQL bar. Soon, they walk out. They couldn't find a table.",
    "How do you generate a random string? Put a Windows user in front of Vim and tell them to exit.",
    "Why did the functions stop calling each other? Because they had constant arguments.",
    "Why do programmers always mix up Halloween and Christmas? Because Oct 31 equals Dec 25.",
    "What did the Java code say to the C code? You've got no class.",
    "What is the most used language in programming? Profanity.",
    "Why was the JavaScript developer sad? He didn't know how to null his feelings.",
    "What's a computer's favorite snack? Microchips.",
    "Why don't programmers like nature? Too many bugs.",
    "Why did the developer go broke? They kept spending all their cache.",
    "What do you call a computer mouse that swears a lot? A cursor!",
    "Why was the developer always calm? Because they knew how to handle exceptions.",
    "Why did the developer go to therapy? They had too many unresolved issues.",
    "What do you call a suspicious looking laptop? Asus.",
    "Where did the API go to eat? To the RESTaurant.",
    "Hey, wanna hear a joke? Parsing HTML with regex.",
    "Why did the scarecrow win an award? Because he was outstanding in his field.",
    "What do you call a fish without eyes? A fsh.",
    "Why don't scientists trust atoms? Because they make up everything.",
    "What do you call a fake noodle? An impasta.",
    "How do you organize a space party? You planet.",
    "Why did the bicycle fall over? Because it was two-tired.",
    "What's brown and sticky? A stick.",
    "Why did the coffee file a police report? It got mugged.",
    "What do you call a bear with no teeth? A gummy bear!",
    "How does a penguin build its house? Igloos it together.",
    "Why don't eggs tell jokes? They'd crack each other up.",
    "What do you call cheese that isn't yours? Nacho cheese.",
    "Why did the math book look sad? Because it had too many problems.",
    "What's the best thing about Switzerland? I don't know, but the flag is a big plus.",
    "Why did the golfer bring two pairs of pants? In case he got a hole in one.",
    "What do you call a dog that does magic tricks? A Labracadabrador.",
    "How do you make a tissue dance? Put a little boogie in it.",
    "What's orange and sounds like a parrot? A carrot.",
    "Why don't oysters share? Because they're shellfish.",
    "What did the ocean say to the shore? Nothing, it just waved.",
];

export interface WaitingContent {
    type: 'joke' | 'hn';
    content: string;
    url?: string;
    score?: number;
}

interface HNStory {
    id: number;
    title: string;
    url?: string;
    score: number;
    type: string;
}

// Cache for HN stories
let hnStoriesCache: HNStory[] = [];
let hnCacheTime = 0;
const HN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const HN_MIN_SCORE = 100;
const HN_FETCH_TIMEOUT = 3000;

// Track shown content to avoid repeats
let shownHNIds = new Set<number>();
let shownJokeIndices = new Set<number>();

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetch top HN stories with score filtering
 */
async function fetchHNStories(): Promise<HNStory[]> {
    if (hnStoriesCache.length > 0 && Date.now() - hnCacheTime < HN_CACHE_TTL) {
        return hnStoriesCache;
    }

    try {
        const idsResponse = await fetchWithTimeout(
            'https://hacker-news.firebaseio.com/v0/topstories.json',
            HN_FETCH_TIMEOUT
        );

        if (!idsResponse.ok) throw new Error(`HN API error: ${idsResponse.status}`);

        const ids: number[] = await idsResponse.json();

        // Fetch first 15 stories in parallel
        const storyPromises = ids.slice(0, 15).map(async (id) => {
            try {
                const response = await fetchWithTimeout(
                    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
                    HN_FETCH_TIMEOUT
                );
                if (!response.ok) return null;
                return await response.json() as HNStory;
            } catch {
                return null;
            }
        });

        const stories = await Promise.all(storyPromises);

        const validStories = stories.filter(
            (s): s is HNStory => s !== null && s.score >= HN_MIN_SCORE && s.type === 'story'
        );

        hnStoriesCache = validStories;
        hnCacheTime = Date.now();

        return validStories;
    } catch (error) {
        console.warn('[WaitingContent] HN fetch failed:', error);
        return hnStoriesCache;
    }
}

/**
 * Get a random joke (avoids repeats until all shown)
 */
export function getRandomJoke(): WaitingContent {
    // Reset if all jokes shown
    if (shownJokeIndices.size >= JOKES.length) {
        shownJokeIndices.clear();
    }

    // Find unshown jokes
    const availableIndices = JOKES.map((_, i) => i).filter(i => !shownJokeIndices.has(i));
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

    shownJokeIndices.add(randomIndex);
    return { type: 'joke', content: JOKES[randomIndex] };
}

/**
 * Get a random HN story (avoids repeats, or fallback to joke)
 */
export async function getRandomHNStory(): Promise<WaitingContent> {
    try {
        const stories = await fetchHNStories();

        if (stories.length === 0) {
            return getRandomJoke();
        }

        // Reset if all stories shown
        if (shownHNIds.size >= stories.length) {
            shownHNIds.clear();
        }

        // Find unshown stories
        const availableStories = stories.filter(s => !shownHNIds.has(s.id));
        if (availableStories.length === 0) {
            return getRandomJoke();
        }

        const story = availableStories[Math.floor(Math.random() * availableStories.length)];
        shownHNIds.add(story.id);

        return {
            type: 'hn',
            content: story.title,
            url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            score: story.score
        };
    } catch {
        return getRandomJoke();
    }
}

// Track last content type to alternate
let lastContentType: 'joke' | 'hn' = 'joke';

/**
 * Get waiting content (alternates between jokes and HN)
 */
export async function getWaitingContent(): Promise<WaitingContent> {
    // Alternate: if last was joke, try HN; if last was HN, show joke
    if (lastContentType === 'joke') {
        lastContentType = 'hn';
        return getRandomHNStory(); // Falls back to joke if HN fails
    } else {
        lastContentType = 'joke';
        return getRandomJoke();
    }
}

/**
 * Preload HN stories (call early to warm cache)
 */
export function preloadHNStories(): void {
    fetchHNStories().catch(() => {});
}
