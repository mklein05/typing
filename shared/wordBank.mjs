// Single source of truth for the typing word bank.
//
// Both sides of the app consume this list:
//   - backend/practice.js      — scores these words against the user's weakest
//                                bigrams to build personalised practice.
//   - frontend TypingTest.jsx  — picks random words for the standard Words test.
//
// Historically each side carried its own copy. They drifted: the frontend list
// had 18 duplicated entries, and the two lists shared only part of their
// vocabulary. Keeping one list means a word added for practice is immediately
// available to the standard test, and vice versa.
//
// Deploy note: this file lives at the repo root, outside either service's
// directory. Railway must build both services from the repository root (or
// otherwise make this path available to each build context), or the imports
// below will fail to resolve. Vite is allowed to read it via `server.fs.allow`
// in frontend/vite.config.js.
//
// The list is the deduplicated union of the two former banks, sorted so diffs
// stay stable. Order carries no meaning: every consumer shuffles before use.

export const WORD_BANK = [
  'a', 'able', 'about', 'above', 'across', 'action', 'add', 'after', 'again', 'against',
  'ago', 'air', 'all', 'almost', 'along', 'already', 'also', 'always', 'among', 'an',
  'and', 'animal', 'another', 'answer', 'any', 'appear', 'area', 'around', 'as', 'ask',
  'asked', 'at', 'away', 'back', 'be', 'beauty', 'became', 'because', 'become', 'before',
  'begin', 'behind', 'being', 'below', 'best', 'better', 'between', 'big', 'bird', 'black',
  'blood', 'blue', 'board', 'boat', 'body', 'book', 'both', 'box', 'bring', 'brought',
  'build', 'built', 'busy', 'but', 'by', 'called', 'came', 'can', 'car', 'care',
  'carry', 'cause', 'center', 'certain', 'change', 'check', 'children', 'church', 'circle', 'city',
  'class', 'clear', 'close', 'cold', 'come', 'common', 'complete', 'contain', 'correct', 'could',
  'country', 'course', 'cover', 'create', 'cry', 'dark', 'day', 'death', 'decide', 'deep',
  'develop', 'different', 'direct', 'distant', 'do', 'does', 'dog', 'done', 'door', 'down',
  'drive', 'dry', 'during', 'each', 'early', 'earth', 'ease', 'east', 'effect', 'either',
  'end', 'enough', 'enter', 'equal', 'equate', 'even', 'ever', 'every', 'example', 'experience',
  'eyes', 'face', 'fact', 'fall', 'family', 'far', 'fast', 'father', 'feel', 'feet',
  'few', 'field', 'figure', 'fill', 'final', 'find', 'fine', 'fire', 'first', 'five',
  'floor', 'fly', 'follow', 'food', 'foot', 'for', 'force', 'form', 'found', 'four',
  'free', 'friend', 'from', 'front', 'full', 'game', 'gave', 'get', 'girl', 'give',
  'glass', 'go', 'going', 'gold', 'gone', 'good', 'got', 'govern', 'great', 'green',
  'ground', 'group', 'grow', 'half', 'hand', 'happen', 'hard', 'have', 'he', 'head',
  'hear', 'heard', 'heart', 'heat', 'heavy', 'help', 'her', 'here', 'high', 'him',
  'his', 'hold', 'home', 'horse', 'hot', 'hour', 'house', 'how', 'however', 'human',
  'hundred', 'idea', 'if', 'important', 'in', 'inch', 'include', 'inside', 'instead', 'interest',
  'into', 'island', 'it', 'its', 'just', 'keep', 'kind', 'king', 'knew', 'know',
  'known', 'land', 'language', 'large', 'last', 'later', 'laugh', 'lay', 'lead', 'learn',
  'least', 'leave', 'left', 'less', 'letter', 'life', 'light', 'like', 'line', 'list',
  'listen', 'little', 'live', 'long', 'look', 'love', 'machine', 'made', 'make', 'many',
  'map', 'mark', 'matter', 'me', 'mean', 'measure', 'might', 'mile', 'mind', 'minute',
  'miss', 'money', 'month', 'moon', 'more', 'morning', 'most', 'mother', 'mountain', 'move',
  'much', 'multiply', 'music', 'must', 'my', 'name', 'near', 'need', 'never', 'new',
  'next', 'night', 'no', 'north', 'not', 'note', 'nothing', 'notice', 'noun', 'now',
  'number', 'object', 'ocean', 'of', 'often', 'oh', 'old', 'on', 'once', 'one',
  'only', 'open', 'or', 'order', 'other', 'our', 'out', 'outside', 'over', 'own',
  'page', 'paint', 'paper', 'part', 'pass', 'past', 'pattern', 'people', 'perhaps', 'period',
  'person', 'picture', 'piece', 'place', 'plain', 'plan', 'plane', 'plant', 'play', 'point',
  'pose', 'possible', 'pound', 'power', 'problem', 'produce', 'product', 'pull', 'put', 'question',
  'quick', 'rain', 'ran', 'reach', 'read', 'ready', 'really', 'record', 'red', 'remember',
  'rest', 'right', 'river', 'road', 'rock', 'room', 'round', 'rule', 'run', 'said',
  'same', 'saw', 'say', 'school', 'second', 'section', 'see', 'seem', 'seen', 'serve',
  'set', 'several', 'shape', 'she', 'ship', 'short', 'should', 'show', 'side', 'simple',
  'since', 'sing', 'six', 'slow', 'small', 'snow', 'so', 'some', 'something', 'song',
  'soon', 'south', 'space', 'special', 'spell', 'stand', 'star', 'start', 'state', 'stay',
  'stead', 'step', 'still', 'stood', 'stop', 'story', 'street', 'strong', 'study', 'such',
  'surface', 'system', 'table', 'tail', 'take', 'talk', 'teach', 'tell', 'ten', 'test',
  'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'think', 'this', 'those', 'though', 'thought', 'thousand', 'three', 'through', 'time', 'tire',
  'to', 'together', 'told', 'took', 'top', 'toward', 'town', 'travel', 'tree', 'true',
  'try', 'turn', 'two', 'under', 'understand', 'unit', 'until', 'up', 'upon', 'us',
  'use', 'used', 'using', 'usual', 'verb', 'very', 'voice', 'vowel', 'wait', 'walk',
  'want', 'war', 'warm', 'watch', 'water', 'way', 'we', 'week', 'weight', 'well',
  'went', 'were', 'west', 'what', 'wheel', 'when', 'where', 'which', 'while', 'white',
  'who', 'whole', 'will', 'wind', 'with', 'within', 'without', 'woman', 'wonder', 'word',
  'work', 'world', 'would', 'write', 'year', 'yes', 'you', 'young', 'your',
];
