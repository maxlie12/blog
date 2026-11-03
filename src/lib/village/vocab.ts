/**
 * Discovery vocabulary for Làng Rêu: verbs heard in action sentences, names of parts shown as
 * labels on pieces, and the nouns for villagers. Learned by looking (the Look tool), not by
 * unlocking. Pure data so it can be tested in Node.
 */

export interface VocabEntry { en: string; ipa: string; vi: string }
const e = (en: string, ipa: string, vi: string): VocabEntry => ({ en, ipa, vi });

export const VERBS = {
  walk: { ...e("walk", "/wɑːk/", "đi bộ"), ing: "walking" },
  run: { ...e("run", "/rʌn/", "chạy"), ing: "running" },
  go: { ...e("go", "/ɡoʊ/", "đi"), ing: "going" },
  carry: { ...e("carry", "/ˈker.i/", "mang, khiêng"), ing: "carrying" },
  water: { ...e("water", "/ˈwɑː.t̬ɚ/", "tưới nước"), ing: "watering" },
  pick: { ...e("pick", "/pɪk/", "hái"), ing: "picking" },
  fish: { ...e("fish", "/fɪʃ/", "câu cá"), ing: "fishing" },
  sit: { ...e("sit", "/sɪt/", "ngồi"), ing: "sitting" },
  read: { ...e("read", "/riːd/", "đọc"), ing: "reading" },
  play: { ...e("play", "/pleɪ/", "chơi"), ing: "playing" },
  kick: { ...e("kick", "/kɪk/", "đá"), ing: "kicking" },
  sell: { ...e("sell", "/sel/", "bán"), ing: "selling" },
  buy: { ...e("buy", "/baɪ/", "mua"), ing: "buying" },
  talk: { ...e("talk", "/tɑːk/", "nói chuyện"), ing: "talking" },
  sweep: { ...e("sweep", "/swiːp/", "quét"), ing: "sweeping" },
  chop: { ...e("chop", "/tʃɑːp/", "chặt, bổ"), ing: "chopping" },
  fill: { ...e("fill", "/fɪl/", "đổ đầy"), ing: "filling" },
  deliver: { ...e("deliver", "/dɪˈlɪv.ɚ/", "giao, đưa"), ing: "delivering" },
  watch: { ...e("watch", "/wɑːtʃ/", "trông, theo dõi"), ing: "watching" },
  wave: { ...e("wave", "/weɪv/", "vẫy tay"), ing: "waving" },
  sleep: { ...e("sleep", "/sliːp/", "ngủ"), ing: "sleeping" },
  rest: { ...e("rest", "/rest/", "nghỉ ngơi"), ing: "resting" },
  chase: { ...e("chase", "/tʃeɪs/", "đuổi theo"), ing: "chasing" },
  eat: { ...e("eat", "/iːt/", "ăn"), ing: "eating" },
  peck: { ...e("peck", "/pek/", "mổ"), ing: "pecking" },
  swim: { ...e("swim", "/swɪm/", "bơi"), ing: "swimming" },
  hop: { ...e("hop", "/hɑːp/", "nhảy cóc, nhảy lò cò"), ing: "hopping" },
  sniff: { ...e("sniff", "/snɪf/", "hít, đánh hơi"), ing: "sniffing" },
  look: { ...e("look", "/lʊk/", "nhìn"), ing: "looking" },
};
export type VerbId = keyof typeof VERBS;

export const PARTS = {
  roof: e("roof", "/ruːf/", "mái nhà"),
  chimney: e("chimney", "/ˈtʃɪm.ni/", "ống khói"),
  door: e("door", "/dɔːr/", "cửa ra vào"),
  window: e("window", "/ˈwɪn.doʊ/", "cửa sổ"),
  wall: e("wall", "/wɔːl/", "bức tường"),
  battlement: e("battlement", "/ˈbæt̬.əl.mənt/", "tường răng cưa (lỗ châu mai)"),
  arch: e("arch", "/ɑːrtʃ/", "vòm cổng"),
  gate: e("gate", "/ɡeɪt/", "cái cổng"),
  bridge: e("bridge", "/brɪdʒ/", "cây cầu"),
  plank: e("plank", "/plæŋk/", "tấm ván"),
  railing: e("railing", "/ˈreɪ.lɪŋ/", "lan can"),
  bank: e("bank", "/bæŋk/", "bờ (sông, suối)"),
  stone: e("stone", "/stoʊn/", "hòn đá"),
  reed: e("reed", "/riːd/", "cây sậy"),
  post: e("post", "/poʊst/", "cái cột"),
  rail: e("rail", "/reɪl/", "thanh ngang (rào)"),
  sail: e("sail", "/seɪl/", "cánh quạt (cánh buồm)"),
  rope: e("rope", "/roʊp/", "dây thừng"),
  bucket: e("bucket", "/ˈbʌk.ɪt/", "cái xô"),
  lamp: e("lamp", "/læmp/", "ngọn đèn"),
  bell: e("bell", "/bel/", "cái chuông"),
  spire: e("spire", "/spaɪr/", "chóp tháp nhọn"),
  awning: e("awning", "/ˈɑː.nɪŋ/", "mái che bằng vải"),
  counter: e("counter", "/ˈkaʊn.t̬ɚ/", "quầy hàng"),
  pole: e("pole", "/poʊl/", "cây sào, cột"),
  pillar: e("pillar", "/ˈpɪl.ɚ/", "cây trụ"),
  seat: e("seat", "/siːt/", "chỗ ngồi"),
  backrest: e("backrest", "/ˈbæk.rest/", "lưng tựa"),
  basin: e("basin", "/ˈbeɪ.sən/", "bể nước"),
  spout: e("spout", "/spaʊt/", "vòi phun"),
  oar: e("oar", "/ɔːr/", "mái chèo"),
  wheel: e("wheel", "/wiːl/", "bánh xe"),
  handle: e("handle", "/ˈhæn.dəl/", "tay cầm"),
  apple: e("apple", "/ˈæp.əl/", "quả táo"),
  sign: e("sign", "/saɪn/", "tấm biển"),
  lid: e("lid", "/lɪd/", "cái nắp"),
  pedestal: e("pedestal", "/ˈped.ə.stəl/", "bệ tượng"),
  book: e("book", "/bʊk/", "quyển sách"),
  hat: e("hat", "/hæt/", "cái mũ"),
  straw: e("straw", "/strɑː/", "rơm"),
  flame: e("flame", "/fleɪm/", "ngọn lửa"),
  bee: e("bee", "/biː/", "con ong"),
  axe: e("axe", "/æks/", "cái rìu"),
  trunk: e("trunk", "/trʌŋk/", "thân cây"),
  branch: e("branch", "/bræntʃ/", "cành cây"),
  leaf: e("leaf", "/liːf/", "chiếc lá"),
  root: e("root", "/ruːt/", "rễ cây"),
  stem: e("stem", "/stem/", "thân, cuống"),
  petal: e("petal", "/ˈpet̬.əl/", "cánh hoa"),
  berry: e("berry", "/ˈber.i/", "quả mọng"),
  cap: e("cap", "/kæp/", "mũ nấm"),
  moss: e("moss", "/mɑːs/", "rêu"),
  soil: e("soil", "/sɔɪl/", "đất trồng"),
  carrot: e("carrot", "/ˈker.ət/", "củ cà rốt"),
  horn: e("horn", "/hɔːrn/", "cái sừng"),
  tail: e("tail", "/teɪl/", "cái đuôi"),
  hoof: e("hoof", "/hʊf/", "móng guốc"),
  mane: e("mane", "/meɪn/", "bờm"),
  beak: e("beak", "/biːk/", "cái mỏ"),
  wing: e("wing", "/wɪŋ/", "cánh"),
  ear: e("ear", "/ɪr/", "cái tai"),
  collar: e("collar", "/ˈkɑː.lɚ/", "vòng cổ"),
  snout: e("snout", "/snaʊt/", "cái mõm"),
  wool: e("wool", "/wʊl/", "lông cừu"),
  whisker: e("whisker", "/ˈwɪs.kɚ/", "ria (mèo)"),
  head: e("head", "/hed/", "cái đầu"),
  hair: e("hair", "/her/", "tóc"),
  arm: e("arm", "/ɑːrm/", "cánh tay"),
  hand: e("hand", "/hænd/", "bàn tay"),
  leg: e("leg", "/leɡ/", "cái chân"),
};
export type PartId = keyof typeof PARTS;

/** Villagers who live in the houses; each house's people are drawn from these. */
export const RESIDENTS = {
  man: e("man", "/mæn/", "người đàn ông"),
  woman: e("woman", "/ˈwʊm.ən/", "người phụ nữ"),
  grandpa: e("grandpa", "/ˈɡræn.pɑː/", "ông"),
  grandma: e("grandma", "/ˈɡræn.mɑː/", "bà"),
  boy: e("boy", "/bɔɪ/", "cậu bé"),
  girl: e("girl", "/ɡɝːl/", "cô bé"),
};
export type ResidentId = keyof typeof RESIDENTS;

/** What someone is doing, written after the subject: “The farmer” + “is watering the vegetables”. */
export interface Action { verb: VerbId; en: string; vi: string }
const a = (verb: VerbId, en: string, vi: string): Action => ({ verb, en, vi });
export const ACTIONS = {
  walk: a("walk", "is walking along the path", "đang đi dạo trên đường"),
  goHome: a("go", "is going home", "đang về nhà"),
  fillBucket: a("fill", "is filling a bucket at the well", "đang múc đầy xô nước ở giếng"),
  sitBench: a("sit", "is sitting on the bench", "đang ngồi trên ghế"),
  readBench: a("read", "is reading a book on the bench", "đang đọc sách trên ghế"),
  buyFruit: a("buy", "is buying fruit at the stall", "đang mua trái cây ở sạp"),
  talk: a("talk", "is talking to a neighbor", "đang nói chuyện với hàng xóm"),
  sweep: a("sweep", "is sweeping in front of the house", "đang quét sân trước nhà"),
  waterGarden: a("water", "is watering the vegetables", "đang tưới rau"),
  pickPumpkins: a("pick", "is picking pumpkins", "đang hái bí ngô"),
  sellBread: a("sell", "is selling bread at the stall", "đang bán bánh mì ở sạp"),
  carryBread: a("carry", "is carrying a basket of bread", "đang mang một giỏ bánh mì"),
  fish: a("fish", "is fishing by the water", "đang câu cá bên bờ nước"),
  watchSheep: a("watch", "is watching the sheep", "đang trông đàn cừu"),
  chopWood: a("chop", "is chopping wood", "đang bổ củi"),
  deliver: a("deliver", "is delivering letters", "đang đi đưa thư"),
  playGuitar: a("play", "is playing the guitar", "đang chơi đàn ghi-ta"),
  kickBall: a("kick", "is kicking a ball", "đang đá bóng"),
  playSwing: a("play", "is playing on the swing", "đang chơi xích đu"),
  runAround: a("run", "is running around", "đang chạy nhảy khắp nơi"),
  wave: a("wave", "is waving at you", "đang vẫy tay chào bạn"),
  restFire: a("rest", "is resting by the campfire", "đang nghỉ bên lửa trại"),
  lookAround: a("look", "is looking around", "đang nhìn quanh"),
  // animals
  roam: a("walk", "is walking around", "đang đi loanh quanh"),
  graze: a("eat", "is eating grass", "đang ăn cỏ"),
  peck: a("peck", "is pecking at the ground", "đang mổ thóc dưới đất"),
  swim: a("swim", "is swimming", "đang bơi"),
  hopAbout: a("hop", "is hopping across the grass", "đang nhảy qua bãi cỏ"),
  sniff: a("sniff", "is sniffing the ground", "đang đánh hơi mặt đất"),
  chase: a("chase", "is chasing the {target}", "đang đuổi theo {target}"),
  chaseBall: a("run", "is running after the ball", "đang chạy theo quả bóng"),
  flee: a("run", "is running away", "đang chạy trốn"),
  sleep: a("sleep", "is sleeping", "đang ngủ"),
  restSun: a("rest", "is resting in the sun", "đang nằm nghỉ dưới nắng"),
};
export type ActionId = keyof typeof ACTIONS;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * “The farmer is watering the vegetables.” / “Bác nông dân đang tưới rau.”
 * `target` fills {target} (e.g. the animal being chased).
 */
export function describe(who: { en: string; vi: string }, actionId: ActionId, target?: { en: string; vi: string }) {
  const action = ACTIONS[actionId];
  const fill = (s: string, word?: string) => (word ? s.replace("{target}", word) : s.replace(" the {target}", "").replace(" {target}", ""));
  const verb = VERBS[action.verb];
  return {
    en: `The ${who.en} ${fill(action.en, target?.en)}.`,
    vi: `${capitalize(who.vi)} ${fill(action.vi, target?.vi)}.`,
    verb: action.verb,
    highlight: verb.ing,
  };
}

/** Keys used for “seen” vocabulary in saved progress. */
export const vocabKey = { verb: (id: VerbId) => `verb:${id}`, part: (id: PartId) => `part:${id}`, resident: (id: ResidentId) => `noun:${id}` };
