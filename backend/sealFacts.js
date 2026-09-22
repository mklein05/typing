// The seal facts served as typing passages.
//
// Kept as its own module because it is a data table, not logic — database schema
// changes should not involve scrolling past it.
//
// Restored from the pre-migration FastAPI backend (`SEAL_FACTS` in the old
// backend/database.py). The Node port kept only the first 7 entries, and because
// the seeder only ran against an empty table, no database ever received the rest.
//
// Each entry used to carry a `difficulty` of 1-3. That was removed: nothing ever
// filtered or displayed it — the API accepted a `difficulty` param that the
// frontend never sent — and a measurement showed it tracked sentence length
// rather than complexity (mean 83/96/108 characters for tiers 1/2/3, while
// characters-per-word stayed flat at ~4.4-4.8). The tiers also overlapped almost
// completely, so a "1" could be longer than a "3". A plain list of strings says
// the same thing without implying a distinction that is not there.
//
// Em dashes in the originals were replaced with commas: an em dash cannot be
// typed on a normal keyboard. Four of the ten were the only thing joining two
// independent clauses, so those became full stops rather than comma splices.
//
// Every string here is printable ASCII. `source` and `category` are left to
// their column defaults ('curated' and 'seal').

export const SEAL_FACTS = [
  "Seals are pinnipeds, a group of marine mammals that also includes sea lions and walruses.",
  "There are 33 species of seals found across the world, from the Arctic to the Antarctic.",
  "The largest seal species is the southern elephant seal. Males can weigh up to 4,000 kilograms!",
  "Harbour seals can hold their breath for up to 30 minutes while diving for food.",
  "Seals have a thick layer of blubber under their skin that keeps them warm in freezing waters.",
  "Unlike dolphins and whales, seals give birth on land or ice, not in the water.",
  "The word 'pinniped' comes from Latin, meaning 'fin-footed' or 'wing-footed'.",
  "Baby seals are called pups. They gain weight incredibly fast thanks to their mother's rich milk.",
  "Some seal pups double their birth weight in just five days. That's like a human baby gaining 30 kilograms!",
  "Leopard seals are fierce predators that hunt penguins and even other seals in Antarctic waters.",
  "The Baikal seal is the only seal species that lives exclusively in freshwater, in Russia's Lake Baikal.",
  "Seals use their whiskers, called vibrissae, to detect fish movements in dark or murky water.",
  "A seal's whiskers are so sensitive they can track a fish's trail from over 100 metres away.",
  "The ringed seal is the smallest seal species. Adults rarely grow longer than 1.5 metres.",
  "Grey seals can be identified by their long, sloping nose, often called a 'Roman nose'.",
  "During breeding season, male elephant seals engage in violent battles for dominance and mating rights.",
  "Seals sleep in the water by floating vertically with just their noses above the surface.",
  "A group of seals on land is called a colony. In the water, it's called a raft.",
  "The Navy has trained seals to locate underwater objects and assist with military operations.",
  "Climate change threatens many seal species by melting the sea ice they rely on for breeding.",
  "The Hawaiian monk seal is one of the most endangered seal species, with fewer than 1,600 left in the wild.",
  "Seals can slow their heart rate from 100 beats per minute down to just 10 when diving deep.",
  "Crabeater seals don't actually eat crabs. Their name is a mistranslation. They eat krill!",
  "The walrus, a close relative of seals, can have tusks over one metre long.",
  "Seals have excellent underwater vision, but on land they are quite nearsighted.",
  "Some seal species can dive deeper than 1,500 metres, nearly a mile beneath the ocean surface.",
  "The harp seal gets its name from the harp-shaped black marking on its back as an adult.",
  "Weddell seals live farther south than any other mammal, enduring Antarctica's brutal winters.",
  "A newborn harp seal pup has a fluffy white coat called lanugo, which helps it stay warm before it grows blubber.",
  "Seals can detect prey using their whiskers even when blindfolded, in completely dark water.",
  "The Mediterranean monk seal is one of the rarest seals, with only about 700 individuals remaining.",
  "Fur seals have the densest fur of any mammal, with up to 300,000 hairs per square inch.",
  "Seals migrate thousands of kilometres each year between feeding and breeding grounds.",
  "A seal's nostrils automatically close when it dives underwater. There is no need to hold them shut!",
  "Elephant seals can stay underwater for nearly two hours without coming up for air.",
  "The Saimaa ringed seal lives in a single lake in Finland and has a population of about 400.",
  "Seals shed their fur every year in a process called moulting, which can take several weeks.",
  "Unlike sea lions, true seals cannot rotate their hind flippers forward, so they move on land by galumphing.",
  "A seal pup recognises its mother's unique call from a colony of thousands of other seals.",
  "Seals have been known to rescue drowning humans by nudging them toward the surface.",
  "The Caspian seal is found only in the Caspian Sea, the world's largest inland body of water.",
  "Seals eat a wide variety of prey, including fish, squid, octopus, and crustaceans.",
  "A seal's milk can contain up to 60% fat, making it one of the richest milks in the animal kingdom.",
  "Spotted seals get their name from the irregular dark spots scattered across their silver-grey coat.",
  "Bearded seals use their long, bushy whiskers to feel along the ocean floor for clams and crabs.",
  "Seals are protected by law in many countries, and hunting them is strictly regulated or banned.",
  "The ribbon seal has striking white bands wrapped around its dark body, making it look like it's wearing ribbons.",
  "Seals can live up to 30 years in the wild, though many don't survive their first year.",
  "Hooded seals have an inflatable nasal sac on their heads that males blow up like a red balloon to attract mates.",
  "Seals communicate with each other using barks, growls, and even slapping the water with their flippers.",
  "A seal's sense of hearing is incredibly acute underwater, allowing it to locate prey by sound alone.",
  "Seals are considered a keystone species in many Arctic ecosystems, meaning their health reflects the ocean's health.",
  "The northern elephant seal was hunted to near extinction in the 1800s, with only about 50 left. Today there are over 200,000!",
  "Seals have no external ear flaps, just small holes behind their eyes that close when diving.",
  "Pregnant seals delay embryo implantation, so pups are born at the ideal time of year regardless of when mating occurred.",
  "Seals spend up to 80% of their lives at sea, only returning to land or ice to rest, moult, and breed.",
  "The Ross seal is one of the least-known seal species because it lives in remote, ice-choked Antarctic waters.",
  "Seals have been observed using tools. A grey seal was seen using a rock to scratch its own back.",
  "Newborn seal pups have no blubber at all. They rely entirely on their mother's warm milk for the first weeks.",
  "A seal's blood contains unusually high levels of oxygen-carrying proteins, letting it store more oxygen for long dives.",
  "Seals can nap while floating at the surface, sometimes drifting for hours before waking up.",
  "Some seal species live in warm tropical waters, like the Galapagos fur seal which thrives near the equator.",
  "Seals have been known to follow fishing boats for easy meals, learning to steal fish from nets and lines.",
  "The dental formula of seals varies between species, but most have sharp, pointed teeth perfect for gripping slippery fish.",
  "Seals are more closely related to bears and weasels than they are to dolphins or whales.",
  "A seal's heart rate can drop from 120 beats per minute at the surface to just 4 beats per minute during a deep dive.",
  "Seals have a special membrane that covers their eyes underwater, acting like built-in goggles.",
  "Harbour seals are the most widely distributed seal species, found along coastlines across the Northern Hemisphere.",
  "Scientists study seal moulting patterns to understand how environmental toxins accumulate in marine food chains.",
  "The Ladoga ringed seal lives only in Lake Ladoga in Russia, Europe's largest freshwater lake by area.",
  "Mother seals fast while nursing their pups, sometimes going weeks without eating while producing rich milk.",
  "Seals can hear ultrasonic frequencies far beyond human range, which may help them evade orcas and other predators.",
  "Leopard seals have been known to present penguins to human divers as if trying to teach them how to hunt.",
  "Some fossil seals date back over 23 million years, making them one of the older groups of marine mammals.",
  "Seals can voluntarily reduce blood flow to their extremities during a dive, conserving oxygen for their brain and heart.",
  "Antarctic fur seals were hunted nearly to extinction in the 19th century. Their population has now rebounded to over 4 million.",
  "Seal pups learn to swim within days of birth, though they usually stay close to shore until they're stronger.",
  "Seals have been trained by scientists to wear sensors that collect ocean temperature and salinity data.",
  "The largest seal colony on Earth is on South Georgia island, home to hundreds of thousands of seals at once.",
  "Seals use their sensitive whiskers to detect the size, shape, and speed of objects in the water without touching them.",
  "Grey seal populations in the UK have doubled in the last 50 years thanks to conservation efforts.",
  "Seals can shut down one hemisphere of their brain at a time while sleeping in the water, staying partially alert.",
  "The Caribbean monk seal was declared extinct in 2008, the first seal species lost entirely to human activity.",
  "Every year, thousands of seal pups are born on the ice floes of Canada's Gulf of St. Lawrence.",
  "Seals have a reflective layer behind their retina called the tapetum lucidum, which gives them excellent night vision.",
  "Male hooded seals can inflate the red balloon-like sac in their nose in under a second to intimidate rivals.",
  "Seals produce a variety of underwater vocalisations, trills, chirps, and roars, especially during mating season.",
  "Scientists can identify individual seals by the unique pattern of spots on their fur, much like a human fingerprint.",
  "Seals sometimes eat stones and pebbles. Researchers think it may help with digestion or buoyancy control.",
  "The northern fur seal was once known as the 'sea bear' because of its thick fur and bear-like gait on land.",
  "Seals can use the Earth's magnetic field to navigate during long migrations across open ocean.",
  "During the breeding season, a single male elephant seal may mate with over 50 females in his harem.",
  "Seal coronaviruses have been found in some wild populations, though none are known to affect humans.",
  "Seals sometimes form cooperative hunting groups, working together to herd fish into tight balls before feeding.",
  "Historic Inuit communities relied on seals for food, clothing, tools, and fuel, using every part of the animal.",
  "The Australian sea lion has a unique 18-month breeding cycle, unlike any other seal or sea lion species.",
  "Seal pups can recognise their mother's scent from birth, helping them reunite after she returns from feeding trips.",
  "The global seal population is estimated to be in the tens of millions, though accurate counts are difficult to obtain.",
];
