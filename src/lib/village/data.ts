/**
 * Làng Rêu (village builder): tools, vocabulary, stroke geometry helpers and save parsing.
 * Pure data and functions only — no React, DOM or three.js — so it is cheap to import and test.
 */

export const ISLAND_R = 22;
export const BUILD_R = 20.4;
export const STEP = 0.5;
export const SCENE_KEY = "village-scene-v1";
export const PROGRESS_KEY = "village-progress-v1";

/** Pieces stored in the generic `props` list (everything added after the first 13 tools). */
export const PROP_KINDS = [
  "barn", "chapel", "stall", "tent", "lighthouse", "gazebo",
  "bush", "flower", "blossom", "sunflower", "mushroom", "rock", "log", "stump", "garden", "pumpkin", "haystack",
  "fountain", "boat",
  "bench", "signpost", "cart", "barrel", "crate", "flag", "statue", "scarecrow", "swing", "campfire", "beehive", "woodpile", "mailbox",
  "chicken", "duck", "cow", "horse", "pig", "dog", "cat", "rabbit",
] as const;
export type PropKind = (typeof PROP_KINDS)[number];
export type StrokeTool = "path" | "wall" | "fence" | "hedge" | "stream";
export type ToolId = "orbit" | "erase" | "house" | "tree" | "tower" | "well" | "pond" | "windmill" | "lantern" | "sheep" | StrokeTool | PropKind;
export type WordId = Exclude<ToolId, "orbit" | "erase">;
export type Category = "build" | "nature" | "water" | "decor" | "animals";
/** How a tool is used: drag a line, tap once, brush (scatter while dragging), or its own gesture. */
export type Place = "orbit" | "erase" | "stroke" | "house" | "pond" | "brush" | "tap";

export type Point = [number, number];
export interface Stroke { id: number; pts: Point[] }
export interface Placed { id: number; x: number; z: number; seed: number; r?: number }
export interface House { id: number; x: number; z: number; len: number; r: number; seed: number }
export interface Tree { id: number; x: number; z: number; s: number; k: 0 | 1; r: number }
export interface Pond { id: number; x: number; z: number; r: number; seed: number }
export interface Prop { id: number; kind: PropKind; x: number; z: number; r: number; seed: number }
export interface VillageScene {
  paths: Stroke[];
  walls: Stroke[];
  fences: Stroke[];
  hedges: Stroke[];
  streams: Stroke[];
  houses: House[];
  towers: Placed[];
  trees: Tree[];
  wells: Placed[];
  ponds: Pond[];
  mills: Placed[];
  lanterns: Placed[];
  sheep: Placed[];
  props: Prop[];
}
export interface SavedScene { scene: VillageScene; idSeq: number }
export interface VillageProgress { unlocked: ToolId[]; learned: Record<string, { at: number; reviewed?: number }>; time: number }

export interface ToolDef {
  id: ToolId;
  label: string;
  hint: string;
  cat: Category | null;
  place: Place;
  /** Footprint radius, used for erasing and for keeping grass and trees off the piece. */
  size: number;
  /** Turns its front towards the nearest path when placed. */
  face?: boolean;
  animal?: boolean;
  /** What an animal says when petted. */
  sound?: string;
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "build", label: "Xây dựng" },
  { id: "nature", label: "Cây & hoa" },
  { id: "water", label: "Nước" },
  { id: "decor", label: "Trang trí" },
  { id: "animals", label: "Con vật" },
];

const tap = (label: string, cat: Category, size: number, hint: string, extra: Partial<ToolDef> = {}) => ({ label, cat, size, hint, place: "tap" as const, ...extra });
const brush = (label: string, size: number, hint: string) => ({ label, cat: "nature" as const, size, hint, place: "brush" as const });
const animal = (label: string, size: number, sound: string) => ({
  label, cat: "animals" as const, size, place: "tap" as const, animal: true, sound,
  hint: `Chạm để thả ${label.toLowerCase()}. Chạm vào một con vật để vuốt ve: “${sound}”`,
});

const DEFS: Record<ToolId, Omit<ToolDef, "id">> = {
  orbit: { label: "Xoay", cat: null, place: "orbit", size: 0, hint: "Kéo để xoay đảo. Hai ngón tay hoặc con lăn chuột để phóng to, thu nhỏ." },
  erase: { label: "Xóa", cat: null, place: "erase", size: 0, hint: "Kéo qua thứ muốn xóa. Lỡ tay thì bấm Hoàn tác." },

  path: { label: "Đường", cat: "build", place: "stroke", size: 0, hint: "Kéo để vẽ đường đi. Đường xuyên qua tường thành cổng, băng qua suối thành cầu." },
  wall: { label: "Tường", cat: "build", place: "stroke", size: 0, hint: "Kéo để xây tường. Tường cắt qua đường sẽ tự mở cổng vòm, góc gắt sẽ mọc tháp." },
  house: { label: "Nhà", cat: "build", place: "house", size: 0, hint: "Chạm để đặt nhà quay về phía đường, hoặc kéo để kéo dài ngôi nhà." },
  tower: tap("Tháp", "build", 1, "Chạm để dựng một ngọn tháp."),
  fence: { label: "Rào", cat: "build", place: "stroke", size: 0, hint: "Kéo để dựng hàng rào gỗ." },
  windmill: tap("Cối xay", "build", 1.1, "Chạm để dựng cối xay gió."),
  barn: tap("Nhà kho", "build", 1.9, "Chạm để dựng nhà kho đỏ; cửa lớn quay về phía đường.", { face: true }),
  chapel: tap("Nhà nguyện", "build", 2, "Chạm để dựng nhà nguyện có gác chuông.", { face: true }),
  stall: tap("Sạp hàng", "build", 1.2, "Chạm để dựng sạp hàng có mái sọc, quay ra đường.", { face: true }),
  tent: tap("Lều", "build", 1.2, "Chạm để dựng lều cắm trại.", { face: true }),
  lighthouse: tap("Hải đăng", "build", 1.3, "Chạm để dựng hải đăng. Ban đêm đèn trên đỉnh sẽ sáng."),
  gazebo: tap("Chòi", "build", 1.5, "Chạm để dựng chòi nghỉ sáu cột."),

  tree: { label: "Cây", cat: "nature", place: "brush", size: 0.6, hint: "Chạm hoặc quét ngón tay để trồng cây." },
  hedge: { label: "Rào cây", cat: "nature", place: "stroke", size: 0, hint: "Kéo để trồng một hàng rào cây xanh." },
  bush: brush("Bụi cây", 0.55, "Chạm hoặc quét để trồng bụi cây."),
  flower: brush("Hoa", 0.35, "Chạm hoặc quét để rải hoa."),
  blossom: brush("Cây hoa", 0.9, "Chạm hoặc quét để trồng cây trổ hoa hồng."),
  sunflower: brush("Hướng dương", 0.4, "Chạm hoặc quét để trồng hướng dương."),
  mushroom: brush("Nấm", 0.35, "Chạm hoặc quét để mọc nấm."),
  rock: brush("Đá", 0.6, "Chạm hoặc quét để đặt đá."),
  log: tap("Khúc gỗ", "nature", 0.7, "Chạm để đặt một khúc gỗ."),
  stump: tap("Gốc cây", "nature", 0.45, "Chạm để đặt gốc cây."),
  garden: tap("Vườn rau", "nature", 1.6, "Chạm để làm luống rau cạnh đường.", { face: true }),
  pumpkin: brush("Bí ngô", 0.4, "Chạm hoặc quét để trồng bí ngô."),
  haystack: tap("Đống rơm", "nature", 0.8, "Chạm để chất đống rơm."),

  pond: { label: "Ao", cat: "water", place: "pond", size: 0, hint: "Đặt ngón tay ở tâm rồi kéo ra để đào ao." },
  stream: { label: "Suối", cat: "water", place: "stroke", size: 0, hint: "Kéo để vẽ suối. Đường đi băng qua suối sẽ tự có cầu gỗ." },
  well: tap("Giếng", "water", 0.8, "Chạm để đặt giếng nước."),
  fountain: tap("Đài nước", "water", 1.3, "Chạm để đặt đài phun nước."),
  boat: tap("Thuyền", "water", 1.1, "Chạm để đặt thuyền; đặt trên ao để thuyền nổi."),

  lantern: tap("Đèn", "decor", 0.3, "Chạm để dựng đèn lồng. Kéo thanh giờ về đêm để thấy đèn sáng."),
  bench: tap("Ghế", "decor", 0.7, "Chạm để đặt ghế băng quay ra đường.", { face: true }),
  signpost: tap("Biển chỉ", "decor", 0.35, "Chạm để cắm cột biển chỉ đường."),
  cart: tap("Xe kéo", "decor", 0.9, "Chạm để đặt xe kéo chở táo.", { face: true }),
  barrel: tap("Thùng tròn", "decor", 0.45, "Chạm để đặt thùng gỗ tròn."),
  crate: tap("Thùng thưa", "decor", 0.45, "Chạm để chồng thùng gỗ thưa."),
  flag: tap("Cờ", "decor", 0.3, "Chạm để cắm cờ."),
  statue: tap("Tượng", "decor", 0.6, "Chạm để dựng tượng đá.", { face: true }),
  scarecrow: tap("Bù nhìn", "decor", 0.5, "Chạm để dựng bù nhìn, hợp đặt cạnh vườn rau."),
  swing: tap("Xích đu", "decor", 0.9, "Chạm để dựng xích đu."),
  campfire: tap("Lửa trại", "decor", 0.6, "Chạm để nhóm lửa trại. Ban đêm lửa sáng rực."),
  beehive: tap("Tổ ong", "decor", 0.4, "Chạm để đặt tổ ong, hợp cạnh hoa."),
  woodpile: tap("Đống củi", "decor", 0.7, "Chạm để chất đống củi."),
  mailbox: tap("Hộp thư", "decor", 0.3, "Chạm để cắm hộp thư cạnh đường.", { face: true }),

  sheep: animal("Cừu", 0.5, "Be-e-e!"),
  chicken: animal("Gà", 0.3, "Cục tác!"),
  duck: animal("Vịt", 0.3, "Quạc quạc!"),
  cow: animal("Bò", 0.8, "Ụm bò!"),
  horse: animal("Ngựa", 0.8, "Hí hí!"),
  pig: animal("Lợn", 0.5, "Ụt ịt!"),
  dog: animal("Chó", 0.4, "Gâu gâu!"),
  cat: animal("Mèo", 0.3, "Meo meo!"),
  rabbit: animal("Thỏ", 0.3, "Thỏ dụi mũi vào tay bạn."),
};

export const TOOLS: ToolDef[] = (Object.keys(DEFS) as ToolId[]).map((id) => ({ id, ...DEFS[id] }));
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;
export const STARTER: ToolId[] = ["orbit", "path", "wall", "house", "tree", "erase"];
export const isPropKind = (value: unknown): value is PropKind => typeof value === "string" && (PROP_KINDS as readonly string[]).includes(value);
/** Brushed plants are drawn as instanced meshes, so thousands stay cheap. */
export const INSTANCED: PropKind[] = ["bush", "flower", "blossom", "sunflower", "mushroom", "rock", "pumpkin"];

export interface WordDef { ipa: string; vi: string; sentence: string; viS: string; tip?: string }
const w = (ipa: string, vi: string, sentence: string, viS: string, tip?: string): WordDef => ({ ipa, vi, sentence, viS, ...(tip ? { tip } : {}) });
export const WORDS: Record<WordId, WordDef> = {
  path: w("/pæθ/", "lối đi, đường mòn", "A narrow ___ leads from the gate to the house.", "Một lối đi hẹp dẫn từ cổng vào nhà."),
  wall: w("/wɔːl/", "bức tường", "The old stone ___ keeps the wind out of the village.", "Bức tường đá cũ chắn gió cho ngôi làng."),
  house: w("/haʊs/", "ngôi nhà", "Their ___ has a blue roof and a small garden.", "Nhà của họ có mái xanh và một khu vườn nhỏ."),
  tower: w("/ˈtaʊ.ɚ/", "ngọn tháp", "From the top of the ___, you can see the whole village.", "Từ đỉnh tháp, bạn có thể nhìn thấy cả ngôi làng.", "Hay đi cùng: bell tower (tháp chuông), watchtower (tháp canh)."),
  fence: w("/fens/", "hàng rào", "We built a low ___ to keep the sheep in the field.", "Chúng tôi dựng một hàng rào thấp để giữ cừu trong cánh đồng.", "Thành ngữ: sit on the fence nghĩa là lưỡng lự, chưa chọn bên nào."),
  windmill: w("/ˈwɪnd.mɪl/", "cối xay gió", "The ___ turns slowly when the wind blows.", "Cối xay gió quay chậm khi gió thổi.", "Từ ghép: wind (gió) + mill (cối xay)."),
  barn: w("/bɑːrn/", "nhà kho (ở nông trại)", "The farmer keeps the hay and the cows in the old red ___.", "Bác nông dân cất rơm và nhốt bò trong nhà kho đỏ cũ.", "barn là nhà kho ở nông trại, chứa cỏ khô, nông cụ hoặc vật nuôi."),
  chapel: w("/ˈtʃæp.əl/", "nhà nguyện", "On Sunday morning, the bell rang in the little ___.", "Sáng Chủ nhật, chuông ngân vang trong nhà nguyện nhỏ.", "chapel nhỏ hơn church (nhà thờ)."),
  stall: w("/stɑːl/", "sạp hàng, quầy hàng", "She sells fresh bread at a ___ in the market.", "Cô ấy bán bánh mì tươi ở một sạp hàng ngoài chợ.", "market stall là sạp ở chợ; food stall là quầy đồ ăn."),
  tent: w("/tent/", "cái lều", "We put up a ___ by the lake and slept under the stars.", "Chúng tôi dựng lều bên hồ và ngủ dưới bầu trời sao.", "put up a tent là dựng lều; take down a tent là dỡ lều."),
  lighthouse: w("/ˈlaɪt.haʊs/", "ngọn hải đăng", "The light from the ___ helps ships find their way at night.", "Ánh sáng từ ngọn hải đăng giúp tàu thuyền tìm đường ban đêm.", "Từ ghép: light (ánh sáng) + house (ngôi nhà)."),
  gazebo: w("/ɡəˈziː.boʊ/", "chòi nghỉ trong vườn", "We drank tea in the ___ at the end of the garden.", "Chúng tôi uống trà trong chòi nghỉ ở cuối vườn."),

  tree: w("/triː/", "cái cây", "We had lunch in the shade of a big ___.", "Chúng tôi ăn trưa dưới bóng một cái cây lớn."),
  hedge: w("/hedʒ/", "hàng rào cây xanh", "A tall ___ separates our garden from the road.", "Một hàng rào cây cao ngăn vườn nhà tôi với con đường."),
  bush: w("/bʊʃ/", "bụi cây", "The cat is hiding behind the ___.", "Con mèo đang trốn sau bụi cây.", "Thành ngữ: beat around the bush nghĩa là nói vòng vo."),
  flower: w("/ˈflaʊ.ɚ/", "bông hoa", "He picked a red ___ for his mother.", "Cậu ấy hái một bông hoa đỏ tặng mẹ.", "flower và flour (bột mì) đọc giống nhau."),
  blossom: w("/ˈblɑː.səm/", "hoa (của cây), cây trổ hoa", "In spring, the trees are covered in pink ___.", "Vào mùa xuân, cây phủ đầy hoa màu hồng.", "cherry blossom là hoa anh đào."),
  sunflower: w("/ˈsʌnˌflaʊ.ɚ/", "hoa hướng dương", "A tall ___ turns its face to the sun.", "Cây hướng dương cao quay mặt về phía mặt trời.", "Từ ghép: sun (mặt trời) + flower (hoa)."),
  mushroom: w("/ˈmʌʃ.ruːm/", "cây nấm", "Don't eat a wild ___ unless you know it is safe.", "Đừng ăn nấm dại trừ khi bạn biết chắc nó an toàn."),
  rock: w("/rɑːk/", "tảng đá", "The children sat on a big ___ by the river.", "Bọn trẻ ngồi trên một tảng đá lớn bên sông.", "rock thường là tảng đá lớn; stone hay chỉ hòn đá nhỏ hoặc chất liệu đá."),
  log: w("/lɑːɡ/", "khúc gỗ", "He put another ___ on the fire to keep us warm.", "Anh ấy cho thêm một khúc gỗ vào lửa để giữ ấm cho chúng tôi.", "log in là đăng nhập; log cũng là nhật ký ghi lại sự việc."),
  stump: w("/stʌmp/", "gốc cây", "After the storm, only a ___ was left where the old tree stood.", "Sau cơn bão, chỉ còn một gốc cây ở chỗ cây cổ thụ từng đứng."),
  garden: w("/ˈɡɑːr.dən/", "khu vườn", "We grow carrots and lettuce in our small ___.", "Chúng tôi trồng cà rốt và rau diếp trong khu vườn nhỏ.", "vegetable garden là vườn rau; flower garden là vườn hoa."),
  pumpkin: w("/ˈpʌmp.kɪn/", "quả bí ngô", "In autumn, she makes soup from a big orange ___.", "Mùa thu, cô ấy nấu súp từ một quả bí ngô to màu cam."),
  haystack: w("/ˈheɪ.stæk/", "đống rơm, đống cỏ khô", "The farmer made a ___ to feed the animals in winter.", "Bác nông dân chất một đống cỏ khô để cho vật nuôi ăn vào mùa đông.", "Thành ngữ: look for a needle in a haystack nghĩa là mò kim đáy bể."),

  pond: w("/pɑːnd/", "cái ao", "Ducks are swimming in the ___ behind the house.", "Đàn vịt đang bơi trong cái ao sau nhà.", "pond nhỏ hơn lake (hồ)."),
  stream: w("/striːm/", "con suối", "The water in the ___ is cold and clear.", "Nước trong con suối lạnh và trong vắt.", "stream nhỏ hơn river (sông). Đường đi băng qua suối sẽ có bridge (cây cầu)."),
  well: w("/wel/", "giếng nước", "The villagers get fresh water from the old ___.", "Dân làng lấy nước sạch từ cái giếng cũ.", "well cũng là trạng từ “tốt, giỏi” (She sings well). Ở đây là danh từ “giếng”."),
  fountain: w("/ˈfaʊn.tən/", "đài phun nước", "People throw coins into the ___ and make a wish.", "Mọi người ném đồng xu vào đài phun nước và ước một điều."),
  boat: w("/boʊt/", "con thuyền", "We took a small ___ across the lake.", "Chúng tôi đi một chiếc thuyền nhỏ qua hồ.", "boat là thuyền nhỏ; ship là tàu lớn."),

  lantern: w("/ˈlæn.tɚn/", "đèn lồng", "She hung a ___ by the door so guests could find the way.", "Cô ấy treo đèn lồng cạnh cửa để khách tìm được đường.", "lantern là đèn có vỏ che, thường mang đi được; lamp là đèn nói chung."),
  bench: w("/bentʃ/", "ghế băng, ghế dài", "Grandpa likes to sit on the ___ and feed the birds.", "Ông thích ngồi trên ghế băng và cho chim ăn."),
  signpost: w("/ˈsaɪn.poʊst/", "cột biển chỉ đường", "The ___ says the village is two kilometers away.", "Cột biển chỉ đường ghi rằng ngôi làng cách đây hai cây số.", "Từ ghép: sign (biển báo) + post (cột)."),
  cart: w("/kɑːrt/", "xe kéo, xe đẩy", "The horse pulled a ___ full of apples.", "Con ngựa kéo một chiếc xe đầy táo.", "shopping cart là xe đẩy ở siêu thị."),
  barrel: w("/ˈber.əl/", "thùng gỗ tròn", "The old ___ is full of rainwater.", "Cái thùng gỗ tròn cũ đầy nước mưa."),
  crate: w("/kreɪt/", "thùng gỗ thưa", "They packed the oranges into a wooden ___.", "Họ xếp cam vào một thùng gỗ thưa."),
  flag: w("/flæɡ/", "lá cờ", "A colorful ___ is flying on top of the tower.", "Một lá cờ sặc sỡ đang bay trên đỉnh tháp."),
  statue: w("/ˈstætʃ.uː/", "bức tượng", "There is a stone ___ of a famous poet in the square.", "Có một bức tượng đá của một nhà thơ nổi tiếng ở quảng trường."),
  scarecrow: w("/ˈsker.kroʊ/", "bù nhìn", "The farmer put a ___ in the field to keep the birds away.", "Bác nông dân dựng bù nhìn trên đồng để đuổi chim.", "Từ ghép: scare (làm sợ) + crow (con quạ)."),
  swing: w("/swɪŋ/", "cái xích đu", "The kids took turns on the ___ under the tree.", "Bọn trẻ thay phiên nhau chơi xích đu dưới gốc cây.", "swing cũng là động từ “đung đưa”."),
  campfire: w("/ˈkæmp.faɪr/", "lửa trại", "We sang songs around the ___.", "Chúng tôi hát quanh đống lửa trại."),
  beehive: w("/ˈbiː.haɪv/", "tổ ong", "Hundreds of bees live in the ___ near the flowers.", "Hàng trăm con ong sống trong tổ ong gần những bông hoa.", "Từ ghép: bee (con ong) + hive (tổ)."),
  woodpile: w("/ˈwʊd.paɪl/", "đống củi", "He took some wood from the ___ to light the stove.", "Anh ấy lấy ít củi từ đống củi để nhóm bếp."),
  mailbox: w("/ˈmeɪl.bɑːks/", "hộp thư", "There's a letter for you in the ___.", "Có một lá thư cho bạn trong hộp thư.", "Anh-Anh hay nói letterbox hoặc postbox."),

  sheep: w("/ʃiːp/", "con cừu", "The ___ are eating grass near the river.", "Đàn cừu đang ăn cỏ gần bờ sông.", "Số nhiều vẫn là sheep: one sheep, two sheep."),
  chicken: w("/ˈtʃɪk.ɪn/", "con gà", "The ___ lays an egg every morning.", "Con gà đẻ một quả trứng mỗi sáng.", "chicken vừa là con gà vừa là thịt gà."),
  duck: w("/dʌk/", "con vịt", "A mother ___ walked to the pond with her babies.", "Một con vịt mẹ dẫn đàn con ra ao.", "duck cũng là động từ “cúi né”: Duck! nghĩa là Cúi xuống!"),
  cow: w("/kaʊ/", "con bò", "The ___ gives us fresh milk every day.", "Con bò cho chúng ta sữa tươi mỗi ngày."),
  horse: w("/hɔːrs/", "con ngựa", "She rides her ___ along the beach.", "Cô ấy cưỡi ngựa dọc bờ biển."),
  pig: w("/pɪɡ/", "con lợn, con heo", "The little ___ is rolling in the mud.", "Chú lợn con đang lăn trong bùn."),
  dog: w("/dɑːɡ/", "con chó", "Our ___ barks when someone knocks on the door.", "Con chó nhà tôi sủa khi có người gõ cửa."),
  cat: w("/kæt/", "con mèo", "The ___ is sleeping in the sun by the window.", "Con mèo đang ngủ dưới nắng bên cửa sổ."),
  rabbit: w("/ˈræb.ɪt/", "con thỏ", "The ___ has long ears and a short, fluffy tail.", "Con thỏ có đôi tai dài và cái đuôi ngắn, xù."),
};
/** Words in dock order: grouped by category. */
export const WORD_ORDER = TOOLS.filter((t) => t.cat).map((t) => t.id as WordId);
export const toolOfWord = (word: WordId) => TOOL[word];
export const wordsIn = (cat: Category) => WORD_ORDER.filter((word) => TOOL[word].cat === cat);

/* ---------- geometry helpers ---------- */

export const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lineLength = (pts: Point[]) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);
export const round2 = (pts: Point[]): Point[] => pts.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash2 = (x: number, z: number) => (Math.imul(Math.round(x * 97), 73856093) ^ Math.imul(Math.round(z * 97), 19349663)) >>> 0;

/** Corner-cutting smoothing; keeps both end points so walls still meet where they were drawn. */
export function chaikin(pts: Point[], iterations: number): Point[] {
  let out = pts;
  for (let k = 0; k < iterations; k += 1) {
    if (out.length < 3) return out;
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i += 1) {
      const [ax, az] = out[i], [bx, bz] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** Points every `step` along the line, plus the exact end point. */
export function resample(pts: Point[], step: number): Point[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const out: Point[] = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i], b = pts[i + 1];
    const len = dist(a, b);
    let t = step - carry;
    while (t <= len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
      t += step;
    }
    carry = len - (t - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.35) out.push([last[0], last[1]]);
  else out[out.length - 1] = [last[0], last[1]];
  return out;
}

export function clampToIsland([x, z]: Point): Point {
  const r = Math.hypot(x, z);
  return r > BUILD_R ? [(x / r) * BUILD_R, (z / r) * BUILD_R] : [x, z];
}

/* ---------- saves ---------- */

export function emptyScene(): VillageScene {
  return { paths: [], walls: [], fences: [], hedges: [], streams: [], houses: [], towers: [], trees: [], wells: [], ponds: [], mills: [], lanterns: [], sheep: [], props: [] };
}

const MAX_ITEMS = 3000;
const finite = (...values: unknown[]) => values.every((v) => typeof v === "number" && Number.isFinite(v));
const onIsland = (x: number, z: number) => Math.hypot(x, z) <= ISLAND_R;
const records = (value: unknown) =>
  (Array.isArray(value) ? value : []).filter((item): item is Record<string, unknown> => !!item && typeof item === "object").slice(0, MAX_ITEMS);

function strokes(value: unknown): Stroke[] {
  return records(value).flatMap((item) => {
    if (!finite(item.id) || !Array.isArray(item.pts)) return [];
    const pts = item.pts.filter((p): p is Point => Array.isArray(p) && p.length === 2 && finite(p[0], p[1]) && onIsland(p[0], p[1])).slice(0, 4000);
    return pts.length >= 2 ? [{ id: item.id as number, pts }] : [];
  });
}
function placed(value: unknown): Placed[] {
  return records(value).flatMap((o) =>
    finite(o.id, o.x, o.z, o.seed) && onIsland(o.x as number, o.z as number)
      ? [{ id: o.id as number, x: o.x as number, z: o.z as number, seed: o.seed as number, ...(finite(o.r) ? { r: o.r as number } : {}) }]
      : []);
}

/** Validates a stored scene; anything malformed is dropped rather than trusted. */
export function parseSavedScene(raw: string | null): SavedScene | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.v !== 1 || !value.scene || typeof value.scene !== "object") return null;
  const s = value.scene as Record<string, unknown>;
  const scene: VillageScene = {
    paths: strokes(s.paths),
    walls: strokes(s.walls),
    fences: strokes(s.fences),
    hedges: strokes(s.hedges),
    streams: strokes(s.streams),
    houses: records(s.houses).flatMap((h) =>
      finite(h.id, h.x, h.z, h.len, h.r, h.seed) && onIsland(h.x as number, h.z as number)
        ? [{ id: h.id as number, x: h.x as number, z: h.z as number, len: Math.min(4.4, Math.max(1.2, h.len as number)), r: h.r as number, seed: h.seed as number }]
        : []),
    towers: placed(s.towers),
    trees: records(s.trees).flatMap((t) =>
      finite(t.id, t.x, t.z, t.s, t.r) && onIsland(t.x as number, t.z as number)
        ? [{ id: t.id as number, x: t.x as number, z: t.z as number, s: Math.min(1.6, Math.max(0.4, t.s as number)), k: t.k === 1 ? 1 : 0, r: t.r as number } satisfies Tree]
        : []),
    wells: placed(s.wells),
    ponds: records(s.ponds).flatMap((p) =>
      finite(p.id, p.x, p.z, p.r, p.seed) && onIsland(p.x as number, p.z as number)
        ? [{ id: p.id as number, x: p.x as number, z: p.z as number, r: Math.min(3.4, Math.max(0.9, p.r as number)), seed: p.seed as number }]
        : []),
    mills: placed(s.mills),
    lanterns: placed(s.lanterns),
    sheep: placed(s.sheep),
    props: records(s.props).flatMap((o) =>
      isPropKind(o.kind) && finite(o.id, o.x, o.z, o.r, o.seed) && onIsland(o.x as number, o.z as number)
        ? [{ id: o.id as number, kind: o.kind, x: o.x as number, z: o.z as number, r: o.r as number, seed: o.seed as number }]
        : []),
  };
  const ids = Object.values(scene).flat().map((item) => item.id);
  const idSeq = Math.max(finite(value.idSeq) ? (value.idSeq as number) : 1, ...ids.map((id) => id + 1));
  return { scene, idSeq };
}

export function parseProgress(raw: string | null): VillageProgress {
  const fallback: VillageProgress = { unlocked: [...STARTER], learned: {}, time: 0.32 };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const unlocked = Array.isArray(data.unlocked) ? data.unlocked.filter((t): t is ToolId => typeof t === "string" && t in TOOL) : [];
    const learned: VillageProgress["learned"] = {};
    if (data.learned && typeof data.learned === "object") {
      for (const [word, entry] of Object.entries(data.learned as Record<string, unknown>)) {
        if (!(word in WORDS) || !entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (finite(e.at)) learned[word] = { at: e.at as number, ...(finite(e.reviewed) ? { reviewed: e.reviewed as number } : {}) };
      }
    }
    return {
      unlocked: [...new Set([...STARTER, ...unlocked])],
      learned,
      time: finite(data.time) ? Math.min(1, Math.max(0, data.time as number)) : fallback.time,
    };
  } catch {
    return fallback;
  }
}

/** Case- and space-insensitive check for the typed answer in a lesson. */
export const isAnswer = (typed: string, word: WordId) => typed.trim().toLowerCase() === word;
