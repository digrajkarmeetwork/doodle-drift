export const PACKS = {
  classic: {
    label: 'Classic',
    blurb: 'Everyday things, easy to draw',
    items: [
      'cat stuck in a tree', 'pizza party', 'snowman melting', 'dog on a skateboard', 'haunted house',
      'birthday cake on fire', 'astronaut fishing', 'traffic jam', 'rainy picnic', 'lighthouse in a storm',
      'robot making coffee', 'shark at the beach', 'camping under the stars', 'penguin in a hot tub',
      'flat tire', 'dragon reading a book', 'rocket launch', 'chef chasing a chicken', 'giant sandwich',
      'mermaid at the dentist', 'volcano erupting', 'treehouse', 'cowboy on a unicorn', 'alarm clock',
      'ghost doing yoga', 'snail race', 'pirate ship', 'hot air balloon', 'bee stealing honey', 'ice cream truck',
      'frog prince', 'roller coaster', 'wizard with a cold', 'castle under siege', 'surfing octopus',
    ],
  },
  couples: {
    label: 'Us two',
    blurb: 'Dates, habits and shared life',
    items: [
      'our first date', 'fighting over the blanket', 'breakfast in bed', 'assembling ikea furniture',
      'road trip snacks', 'slow dancing in the kitchen', 'arguing over the thermostat', 'lazy sunday',
      'getting lost on vacation', 'binge watching a show', 'cooking dinner together', 'meeting the parents',
      'moving day', 'grocery run at midnight', 'hogging the bathroom', 'proposal on a mountain',
      'picking a restaurant', 'stealing fries', 'wedding cake', 'honeymoon on the beach',
      'snoring partner', 'adopting a puppy', 'date night at the movies', 'surprise flowers',
      'couple costumes at halloween', 'karaoke duet', 'lost the car keys', 'airport goodbye',
      'cuddling on the couch', 'painting the new home', 'burnt toast anniversary', 'stargazing on the roof',
    ],
  },
  silly: {
    label: 'Unhinged',
    blurb: 'Hard to draw, harder to guess',
    items: [
      'existential crisis at the gym', 'a potato running for mayor', 'tax season', 'wifi going down',
      'cat judging your life choices', 'monday morning', 'a confident pigeon', 'spaghetti tornado',
      'déjà vu', 'banana in witness protection', 'the floor is lava', 'zombie at a job interview',
      'socks disappearing in the dryer', 'toaster with feelings', 'dinosaur doing taxes', 'brain freeze',
      'a vampire at the beach', 'awkward elevator silence', 'grandma on a jetski', 'sentient cloud',
      'reply all disaster', 'the last slice', 'evil twin', 'a very small horse', 'quantum physics',
    ],
  },
}
PACKS.mixed = {
  label: 'Shuffle',
  blurb: 'A bit of everything',
  items: [...PACKS.classic.items, ...PACKS.couples.items, ...PACKS.silly.items],
}

export function deal(pack, n = 3, avoid = []) {
  const pool = (PACKS[pack] || PACKS.classic).items.filter((p) => !avoid.includes(p))
  const out = []
  const copy = [...pool]
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  return out
}
