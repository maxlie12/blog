/**
 * Short conversations in Làng Rêu, shown as speech bubbles: neighbours chatting, and villagers
 * talking to animals (who answer, storybook style). Each line has English and Vietnamese. Pure
 * data so it can be tested in Node.
 */

export interface TalkLine { who: "a" | "b"; en: string; vi: string }
export interface Chat { id: string; lines: TalkLine[] }
const A = (en: string, vi: string): TalkLine => ({ who: "a", en, vi });
const B = (en: string, vi: string): TalkLine => ({ who: "b", en, vi });

/** Neighbours. `when` limits a chat to a part of the day (by the scene's 0–1 time). */
const PEOPLE: (Chat & { when?: "morning" | "evening" })[] = [
  { id: "morning", when: "morning", lines: [A("Good morning!", "Chào buổi sáng!"), B("Good morning! Did you sleep well?", "Chào buổi sáng! Tối qua ngủ ngon không?"), A("Yes, very well, thanks.", "Ngon lắm, cảm ơn nhé.")] },
  { id: "evening", when: "evening", lines: [A("Good evening!", "Chào buổi tối!"), B("Good evening! It's getting dark.", "Chào buổi tối! Trời sắp tối rồi."), A("Yes, time to go home.", "Ừ, đến giờ về nhà rồi.")] },
  { id: "how", lines: [A("Hello! How are you?", "Chào! Bạn khỏe không?"), B("I'm fine, thank you. And you?", "Mình khỏe, cảm ơn. Còn bạn?"), A("Very well!", "Mình rất khỏe!")] },
  { id: "market", lines: [A("Where are you going?", "Bạn đi đâu đấy?"), B("I'm going to the market.", "Mình đi chợ."), A("Can you buy some apples for me?", "Mua giúp mình ít táo nhé?"), B("Of course!", "Được chứ!")] },
  { id: "lunch", lines: [A("Have you had lunch?", "Bạn ăn trưa chưa?"), B("Not yet. I'm so hungry!", "Chưa. Mình đói quá!"), A("Let's eat together.", "Mình ăn cùng nhau nhé.")] },
  { id: "weather", lines: [A("What a lovely day!", "Hôm nay đẹp trời quá!"), B("Yes, the sun is warm.", "Ừ, nắng ấm thật."), A("Let's go for a walk.", "Mình đi dạo đi.")] },
  { id: "rain", lines: [A("Look at those clouds.", "Nhìn mấy đám mây kìa."), B("I think it's going to rain.", "Mình nghĩ trời sắp mưa."), A("I'll take my umbrella.", "Mình sẽ mang ô theo.")] },
  { id: "garden", lines: [A("Your flowers are beautiful.", "Hoa nhà bạn đẹp quá."), B("Thank you! I water them every day.", "Cảm ơn! Ngày nào mình cũng tưới."), A("Can I have some seeds?", "Cho mình xin ít hạt giống nhé?")] },
  { id: "help", lines: [A("Can you help me, please?", "Bạn giúp mình được không?"), B("Sure. What do you need?", "Được chứ. Bạn cần gì?"), A("I can't find my cat.", "Mình không tìm thấy con mèo."), B("I saw it near the well.", "Mình thấy nó ở gần giếng.")] },
  { id: "thanks", lines: [A("Thank you for the bread!", "Cảm ơn bạn vì ổ bánh mì!"), B("You're welcome.", "Không có gì."), A("It's delicious.", "Ngon lắm.")] },
];

/** A villager and an animal; `a` is the person, `b` the animal. */
const ANIMALS: Record<string, Chat[]> = {
  dog: [
    { id: "dog-play", lines: [A("Good dog! Do you want to play?", "Chó ngoan! Muốn chơi không?"), B("Woof! Yes, throw the ball!", "Gâu! Có, ném bóng đi!")] },
    { id: "dog-walk", lines: [A("Let's go for a walk.", "Mình đi dạo nhé."), B("Woof woof! I love walks!", "Gâu gâu! Tớ thích đi dạo lắm!")] },
  ],
  cat: [
    { id: "cat-hungry", lines: [A("Hello, kitty. Are you hungry?", "Chào mèo con. Đói không?"), B("Meow! I want some fish.", "Meo! Tớ muốn ăn cá.")] },
    { id: "cat-sleepy", lines: [A("Are you sleepy?", "Buồn ngủ hả?"), B("Meow… let me sleep in the sun.", "Meo… cho tớ ngủ dưới nắng.")] },
  ],
  cow: [{ id: "cow-grass", lines: [A("Good morning, cow!", "Chào bò!"), B("Moo! The grass is delicious.", "Ụm bò! Cỏ ngon lắm.")] }],
  chicken: [{ id: "chicken-corn", lines: [A("Here, chick-chick-chick!", "Lại đây, cục cục cục!"), B("Cluck! Thank you for the corn!", "Cục tác! Cảm ơn nắm ngô nhé!")] }],
  sheep: [{ id: "sheep-home", lines: [A("Come on, sheep, let's go home.", "Đi nào cừu ơi, về nhà thôi."), B("Baa! We're coming!", "Be! Chúng tớ đến đây!")] }],
  horse: [{ id: "horse-ride", lines: [A("Hello, horse! Shall we go for a ride?", "Chào ngựa! Mình đi một vòng nhé?"), B("Neigh! Let's go!", "Hí! Đi thôi!")] }],
  pig: [{ id: "pig-mud", lines: [A("You are so muddy!", "Bạn lấm bùn quá!"), B("Oink! I love mud!", "Ụt ịt! Tớ thích bùn mà!")] }],
  duck: [{ id: "duck-water", lines: [A("Hello, ducks! Is the water cold?", "Chào vịt! Nước có lạnh không?"), B("Quack! It's just right!", "Quạc! Vừa đẹp luôn!")] }],
  rabbit: [{ id: "rabbit-carrot", lines: [A("Would you like a carrot?", "Bạn muốn ăn cà rốt không?"), B("Yes, please! Thank you!", "Có ạ! Cảm ơn bạn!")] }],
  goat: [{ id: "goat-hat", lines: [A("Please don't eat my hat!", "Đừng ăn mũ của tôi nhé!"), B("Maa! But it looks tasty!", "Be be! Nhưng trông ngon mà!")] }],
  goose: [{ id: "goose-pond", lines: [A("Please don't chase me!", "Đừng đuổi tôi nhé!"), B("Honk! This is my pond!", "Quác! Đây là ao của tớ!")] }],
  buffalo: [{ id: "buffalo-field", lines: [A("Let's go to the rice field.", "Mình ra ruộng nào."), B("Moo! I'm ready to work.", "Nghé ọ! Tớ sẵn sàng rồi.")] }],
  frog: [{ id: "frog-jump", lines: [A("Hello, little frog!", "Chào ếch con!"), B("Ribbit! Watch me jump!", "Ộp ộp! Xem tớ nhảy này!")] }],
  fish: [{ id: "fish-swim", lines: [A("Hello, little fish!", "Chào cá nhỏ!"), B("Blub blub! Come and swim with me!", "Bõm bõm! Xuống bơi với tớ đi!")] }],
};

export const ALL_CHATS: Chat[] = [...PEOPLE, ...Object.values(ANIMALS).flat()];
export const CHAT = Object.fromEntries(ALL_CHATS.map((c) => [c.id, c])) as Record<string, Chat>;
export const animalCanTalk = (kind: string) => kind in ANIMALS;

/** A chat that fits who is talking and the time of day (0 morning … 1 night). */
export function pickChat(with_: "person" | string, time: number, random: () => number = Math.random): Chat {
  if (with_ !== "person") {
    const list = ANIMALS[with_] ?? ANIMALS.dog;
    return list[Math.floor(random() * list.length) % list.length];
  }
  const part = time < 0.3 ? "morning" : time > 0.62 ? "evening" : null;
  const fits = PEOPLE.filter((c) => !c.when || c.when === part);
  // The greeting for this part of the day comes up more often than any one chat.
  const timed = fits.find((c) => c.when);
  if (timed && random() < 0.35) return timed;
  return fits[Math.floor(random() * fits.length) % fits.length];
}

/** Seconds each line stays up: long enough to read, shorter for short lines. */
export const lineSeconds = (line: TalkLine) => Math.min(4.2, 1.8 + line.en.length * 0.06);
