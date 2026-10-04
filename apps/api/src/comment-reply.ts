import { AppError } from './http';

type BasketProduct = {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  categories?: string[] | null;
  attributes?: Array<{ name?: string | null; value?: string | null }> | null;
  variations?: string[] | null;
  models?: Array<{ name?: string | null; price?: number | null; stock?: number | null }> | null;
  url?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  currentPrice?: number | null;
  current_price?: number | null;
  salePrice?: number | null;
  livePrice?: number | null;
  priceBeforeDiscount?: number | null;
  stock?: number | null;
  sold?: number | null;
  discount?: number | string | null;
  isOutOfStock?: boolean | null;
  shopId?: number | string | null;
  itemId?: number | string | null;
};

export type CommentReplyInput = {
  comment: string;
  customerName?: string | null;
  channelName?: string | null;
  apiKey?: string | null;
  basketItemsJson?: string | null;
  basketLinks?: string | null;
};

function parseBasketProducts(raw?: string | null): BasketProduct[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function parseBasketLinks(raw?: string | null) {
  return (raw || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function displayPrice(product: BasketProduct) {
  const price = product.livePrice ?? product.salePrice ?? product.currentPrice ?? product.current_price ?? product.price ?? product.priceMin ?? product.priceMax;
  return typeof price === 'number' && Number.isFinite(price) ? price : null;
}

function displayPriceRange(product: BasketProduct) {
  const min = product.priceMin ?? product.price ?? product.currentPrice ?? product.current_price ?? product.salePrice ?? product.livePrice ?? null;
  const max = product.priceMax ?? null;
  if (typeof min !== 'number' || !Number.isFinite(min)) return null;
  if (typeof max !== 'number' || !Number.isFinite(max) || max === min) return { min, max: min };
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function productIndexFromComment(comment: string, productsLength: number) {
  const thaiDigits: Record<string, string> = {
    '๐': '0',
    '๑': '1',
    '๒': '2',
    '๓': '3',
    '๔': '4',
    '๕': '5',
    '๖': '6',
    '๗': '7',
    '๘': '8',
    '๙': '9',
  };
  const normalized = comment.replace(/[๐-๙]/g, (digit) => thaiDigits[digit] || digit);
  const patterns = [
    /(?:ตะกร้า|สินค้า|ตัว|เบอร์|ลำดับ|เลข)\s*(?:ที่)?\s*(\d{1,3})/i,
    /(?:ขอดู|ดู|เอา|สนใจ)\s*(?:ตะกร้า|สินค้า|ตัว|เบอร์)?\s*(\d{1,3})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = match ? Number(match[1]) : 0;
    if (Number.isInteger(value) && value >= 1 && value <= productsLength) return value - 1;
  }
  return null;
}

function matchProducts(comment: string, products: BasketProduct[]) {
  const index = productIndexFromComment(comment, products.length);
  if (index !== null) return [products[index]];

  const normalizedComment = normalizeText(comment);
  if (!normalizedComment) return [];
  const isComplexionQuestion = /(ผิว|สีผิว|สองสี|2สี|ขาวเหลือง|ผิวขาว|ผิวเข้ม|เบอร์|เฉด|คุมมัน|ปกปิด|แป้ง|คุชชั่น|รองพื้น)/i.test(comment);
  const isLipQuestion = /(ลิป|ปาก|สีปาก|ชมพู|แดง|ส้ม|ตุ่น|นู้ด|โทน)/i.test(comment);
  if (isComplexionQuestion || isLipQuestion) {
    const preferred = products
      .filter((product) => {
        const title = normalizeText(product.name || product.title || '');
        if (isComplexionQuestion && /(แป้ง|พัฟ|คุชชั่น|รองพื้น|powder|cushion|foundation)/i.test(title)) return true;
        if (isLipQuestion && /(ลิป|lip|matte|tint|กลอส)/i.test(title)) return true;
        return false;
      })
      .slice(0, 8);
    if (preferred.length) return preferred;
  }
  return products
    .map((product) => {
      const title = product.name || product.title || '';
      const normalizedTitle = normalizeText(title);
      if (!normalizedTitle) return { product, score: 0 };
      const titleTokens = normalizedTitle.split(/\s+/).filter((token) => token.length >= 2);
      const score = titleTokens.reduce((sum, token) => sum + (normalizedComment.includes(token) ? 1 : 0), 0);
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.product);
}

function compactProduct(product: BasketProduct, index: number) {
  const currentPrice = displayPrice(product);
  const priceRange = displayPriceRange(product);
  return {
    index: index + 1,
    name: product.name || product.title || `สินค้า ${index + 1}`,
    currentPrice,
    price: currentPrice,
    priceRange,
    stock: product.stock ?? null,
    sold: product.sold ?? null,
    discount: product.discount ?? null,
    priceBeforeDiscount: product.priceBeforeDiscount ?? null,
    priceRule: 'ใช้ currentPrice/price/priceRange จาก API เป็นราคาจริงเท่านั้น ห้ามใช้ตัวเลขราคาที่อยู่ในชื่อหรือรายละเอียดสินค้า',
    isOutOfStock: Boolean(product.isOutOfStock),
    description: product.description ? String(product.description).slice(0, 900) : null,
    categories: Array.isArray(product.categories) ? product.categories.slice(0, 6) : [],
    attributes: Array.isArray(product.attributes)
      ? product.attributes
        .map((attribute) => ({ name: attribute.name || '', value: attribute.value || '' }))
        .filter((attribute) => attribute.name && attribute.value)
        .slice(0, 16)
      : [],
    variations: Array.isArray(product.variations) ? product.variations.slice(0, 8) : [],
    models: Array.isArray(product.models)
      ? product.models
        .map((model) => ({ name: model.name || '', price: model.price ?? null, stock: model.stock ?? null }))
        .filter((model) => model.name || model.price !== null || model.stock !== null)
        .slice(0, 12)
      : [],
    url: product.url ?? null,
    shopId: product.shopId ?? null,
    itemId: product.itemId ?? null,
  };
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  const pieces: string[] = [];
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === 'string') pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

function openAiErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, any>;
    return record.error?.message || record.message || fallback;
  }
  return fallback;
}

async function callOpenAi(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = openAiErrorMessage(payload, `OpenAI HTTP ${response.status}`);
    throw new AppError(`OpenAI API key ใช้งานไม่ได้: ${message}`, response.status >= 500 ? 502 : 400);
  }
  return payload;
}

export async function verifyOpenAiApiKey(apiKey?: string | null) {
  const key = apiKey?.trim();
  if (!key) throw new AppError('กรุณาวาง OpenAI API key ก่อนตรวจสอบ', 400);
  const model = process.env.OPENAI_COMMENT_MODEL?.trim() || 'gpt-4o-mini';
  await callOpenAi(key, {
    model,
    input: 'ตอบกลับคำว่า ok เท่านั้น',
    temperature: 0,
    max_output_tokens: 16,
  });
  return {
    ready: true,
    model,
  };
}

export async function generateCommentReply(input: CommentReplyInput) {
  const apiKey = input.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError('ยังไม่ได้ตั้งค่า OPENAI_API_KEY บนเซิร์ฟเวอร์', 500, {
      missing: 'OPENAI_API_KEY',
    });
  }

  const products = parseBasketProducts(input.basketItemsJson);
  const links = parseBasketLinks(input.basketLinks);
  const matchedProducts = matchProducts(input.comment, products);
  const model = process.env.OPENAI_COMMENT_MODEL?.trim() || 'gpt-4o-mini';
  const productContext = (matchedProducts.length ? matchedProducts : products)
    .slice(0, 20)
    .map(compactProduct);

  const systemPrompt = [
    'คุณเป็นแอดมินคนจริงที่กำลังช่วยตอบคอมเมนต์ในไลฟ์สดของร้านค้า NP LIVE',
    'ตอบเป็นภาษาไทยแบบแม่ค้าไลฟ์คุยกับลูกค้าจริง เป็นกันเอง นุ่มนวล และช่วยปิดการขาย',
    'ใช้ภาษาคนพูดในไลฟ์ ไม่ต้องเหมือนประโยคตัวอย่างทุกครั้ง ให้หมุนคำให้หลากหลายตามคำถามลูกค้า',
    'ตอบสั้น กระชับ ดูเป็นธรรมชาติ ไม่เกิน 2 ประโยค และไม่ต้องสุภาพแข็งเกินไป',
    'หลีกเลี่ยงภาษาบอท/ภาษารายงาน เช่น “จากข้อมูล”, “ระบบพบว่า”, “ข้อมูลสินค้า”, “คำตอบ:”, “สินค้าดังกล่าว”',
    'ห้ามใช้คำที่ดูเป็นบอทหรือเหมือนปุ่มลิงก์ เช่น “กดที่นี่”, “คลิกที่นี่”, “ลิงก์นี้”, “ตามลิงก์”, “รายละเอียดเพิ่มเติม”',
    'เวลาปิดการขายให้ใช้คำแนวสั่งซื้อจริง ไม่ใช่เสนอเป็นตัวเลือก หมุนคำได้หลายแบบ เช่น สั่งซื้อที่ตะกร้าเลขนั้นได้เลย, กดสั่งซื้อได้เลย, จัดได้เลยค่ะ, ราคาไลฟ์ดีมาก, ตัวนี้ขายดี, ของดีจริง',
    'ถ้ารู้เลขตะกร้าจากคำถาม ให้ปิดด้วยเลขตะกร้านั้น แต่ห้ามใช้ประโยคเดิมซ้ำ ๆ ทุกครั้ง',
    'ห้ามใช้สำนวนที่ฟังเหมือนให้เลือกเฉย ๆ เช่น “รับตัวนี้ใส่ตะกร้า”, “สนใจรับใส่ตะกร้า”, “ลองดูได้”, “เลือกดูได้”',
    'เมนต์พื้นฐานต้องตอบให้เหมือนแอดมินหน้าไลฟ์: ถ้าลูกค้าทักทาย เช่น สวัสดีจ้า/ดีค่ะ/หวัดดี ให้ตอบทักกลับและเรียกชื่อ customerName ถ้ามี แล้วชวนเลือกดูสินค้า/โปรในไลฟ์แบบแม่ค้า ไม่ใช่บริการลูกค้า',
    'ห้ามใช้สำนวนแอดมินศูนย์บริการ เช่น “มีอะไรให้แอดมินช่วยไหมคะ”, “ต้องการให้ช่วยอะไรไหม”, “สอบถามเพิ่มเติมได้” แบบแห้ง ๆ ให้เปลี่ยนเป็นโทนไลฟ์ขายของ',
    'สำหรับเมนต์ทักทายหรือเมนต์ทั่วไป ให้ชวนดูสินค้าโดยอิงสินค้าจริงในตะกร้า เช่น ถ้าขายคุชชั่น/แป้งให้พูดแนวโปรคุชชั่นหรือแป้งพัฟ งานผิวดี คุมมัน ราคาไลฟ์ดี สอบถามเบอร์ได้เลย ห้ามใช้คำรวม ๆ ว่า “สินค้าสวย ๆ” ถ้าไม่ตรงหมวด',
    'ถ้าลูกค้าชม เช่น น่ารักจัง/อันนี้น่ารัก/สวยมาก/ชอบจัง ให้รับคำชมก่อน ไม่ต้องปิดการขายทันที เพราะลูกค้าไม่ได้ถามซื้อ ตอบแนวขอบคุณและคุยต่อแบบธรรมชาติ',
    'คำชมควรตอบเบา ๆ เช่น ขอบคุณนะคะคุณ..., น่ารักจริงค่ะ, สีสวยมากค่ะ, ตัวนี้ลูกค้าชอบเยอะเลยค่ะ ห้ามต่อท้ายด้วย “กดสั่งซื้อได้เลย” เว้นแต่ลูกค้าถามราคา ถามซื้อ หรือบอกว่าสนใจ',
    'แยกเจตนาให้ดี: ทักทายให้ทักกลับ, ชมให้ขอบคุณ, ถามข้อมูลให้ตอบข้อมูล, ถามราคา/ถามซื้อ/บอกเอา/บอกสนใจจริง ๆ ค่อยปิดการขาย',
    'คำอ้างอิงสินค้าในคอมเมนต์มีได้หลายแบบมาก เช่น อันนี้ ตัวนี้ ชิ้นนี้ แบบนี้ รุ่นนี้ สีนี้ เบอร์นี้ เฉดนี้ ไซส์นี้ เซ็ตนี้ แพ็กนี้ กระปุกนี้ ขวดนี้ ซองนี้ ตัวที่โชว์ ตัวที่ปัก ตัวเมื่อกี้ ตัวบนจอ ให้ตีความตามบริบท ถ้ายังไม่รู้ว่าหมายถึงสินค้าไหนให้ถามกลับ ห้ามเดาราคาเอง',
    'ถ้าลูกค้าถามราคาด้วยคำอ้างอิงกว้าง ๆ เช่น ราคาเท่าไหร่ เท่าไหร่คะ กี่บาท ลดเหลือเท่าไหร่ แต่ยังระบุสินค้าไม่ชัด ให้ถามกลับแบบคนจริงก่อนว่าหมายถึงตะกร้าไหนหรือตัวไหน',
    'ถ้าลูกค้าถามราคาและระบุสินค้าได้พอชัด เช่น มีเลขตะกร้า ชื่อสินค้า สี รุ่น หรือคำใบ้ที่จับคู่ได้ ให้ตอบราคาจาก field API เท่านั้น แล้วปิดการขายด้วยคำสั่งซื้อแบบธรรมชาติ',
    'รองรับสินค้าทุกประเภทใน Shopee Live ไม่ใช่แค่เครื่องสำอาง เช่น ครีม สบู่ กันแดด คุชชั่น เสื้อ กางเกง กระเป๋า ขวด ของใช้ ของกิน อุปกรณ์ต่าง ๆ',
    'ถ้าคำถามของลูกค้าต้องอิงสินค้าตัวใดตัวหนึ่ง เช่น สี ไซส์ เบอร์ เฉด ขนาด ความจุ รุ่น กลิ่น รส แพ็ก วัสดุ ราคา ใช้ดีไหม กันน้ำไหม เหมาะกับใคร หรือใส่ได้ไหม ให้พยายามระบุตัวสินค้าจากทุกอย่างที่ลูกค้าพิมพ์ก่อน ไม่จำเป็นต้องเป็นเลขตะกร้าเสมอไป',
    'ลูกค้าอาจระบุสินค้าแบบไม่ตรงระบบ เช่น เลขตะกร้า ชื่อสินค้าแบบสั้น ๆ คำเรียกเล่น สี รุ่น แพ็ก จำนวน รูปแบบสินค้า หรือคำอย่าง แป้งดำ แป้งขาว คุชชั่น ลิปแดง สบู่ก้อน ขวดเล็ก เสื้อสีดำ ไซส์ L ถ้าพอจับคู่กับสินค้าในตะกร้าได้ ให้ตอบสินค้านั้นเลย',
    'ถ้ามีหลายตะกร้าที่คล้ายกันจนยังไม่แน่ใจ ห้ามเดาสุ่ม ให้ถามกลับแบบคนจริงเพื่อให้ลูกค้าระบุเพิ่ม เช่น ตะกร้าไหน สีไหน ไซส์ไหน รุ่นไหน หรือชิ้นไหน',
    'ถ้าลูกค้าบอกตะกร้า/ชื่อ/คำใบ้แล้วแต่ยังขาดตัวเลือกสำคัญ ให้ถามต่อให้ตรงประเภทสินค้า เช่น เสื้อผ้าถามไซส์/สี, เครื่องสำอางถามเบอร์/เฉด/โทนผิว, ครีม/สบู่ถามสูตรหรือขนาด, ขวด/ของใช้ถามขนาด/สี/จำนวน, สินค้ามีรุ่นให้ถามรุ่น',
    'การถามกลับต้องใช้ถ้อยคำธรรมชาติและหลากหลาย เช่น ถามว่าหมายถึงตัวไหน เดี๋ยวแอดมินดูให้, ขอชื่อตะกร้าหรือเลขตะกร้านิดนึงค่ะจะได้แนะนำตรงตัว, สีไหนหรือไซส์ไหนคะลูกค้า, ตัวที่เป็นแป้งหรือคุชชั่นคะ ห้ามใช้ประโยคเดียวซ้ำตลอด',
    'ไม่ต้องทักยาว ไม่ต้องอธิบายขั้นตอน ให้ตอบเหมือนกำลังช่วยขายของหน้าไลฟ์อยู่จริง',
    'ใช้ข้อมูลสินค้าในตะกร้าเป็นหลัก ห้ามแต่งราคา สต็อก โปรโมชัน หรือรายละเอียดที่ไม่มีในข้อมูล',
    'ทุกคำตอบต้องดูสินค้าในตะกร้าก่อนว่ากำลังขายอะไร แล้วเลือกคำให้ตรงหมวดสินค้า ห้ามพูดกว้าง ๆ หรือมั่วประเภทสินค้า',
    'ถ้าตะกร้าเป็นคุชชั่น/แป้ง/สกินแคร์ ให้ใช้คำอย่าง งานผิว เนียน คุมมัน ปกปิด กันน้ำ เฉด เบอร์ ผิวสวย ตามข้อมูลที่มี ไม่ใช้คำว่า “สินค้าสวย ๆ” แบบลอย ๆ',
    'ถ้าตะกร้าเป็นเสื้อผ้า/กระเป๋า/ของแต่งบ้าน ค่อยใช้คำว่า สวย น่ารัก สีสวย ทรงสวย ได้ตามบริบทสินค้า',
    'ถ้าตะกร้าเป็นของใช้ เช่น ขวด แก้ว อุปกรณ์ ให้ใช้คำว่า ใช้ง่าย คุ้ม ทน ขนาดดี พกสะดวก ตามข้อมูลที่มี ไม่พูดเรื่องผิวหรือความสวย',
    'ราคาที่ถูกต้องต้องใช้จาก field API เท่านั้น: currentPrice หรือ price หรือ priceRange ห้ามใช้ตัวเลขราคาที่อยู่ในชื่อสินค้า/รายละเอียดสินค้า/ข้อความในวงเล็บ',
    'ถ้า priceRange มี min/max ให้ขายแบบ “เริ่มต้น ... บาท” หรือ “ประมาณ ...-... บาท” ตามข้อมูล API',
    'ถ้ามี priceBeforeDiscount หรือ discount ให้พูดฟีลลดอยู่/ราคาดีได้ แต่ห้ามบอกราคาเก่าหรือเปอร์เซ็นต์ถ้า field ไม่มี',
    'ถ้าลูกค้าพิมพ์แนว “ขอดูตะกร้า 16”, “ขอดูตะกร้า20”, “ดูตะกร้า 30” หรือขอดูเลขตะกร้าใด ๆ ให้ตอบสั้น ๆ ว่า “แอดมินรันให้ทีละรายการนะคะ” หรือ “แอดมินรันให้ทีละรายการนะครับ” ห้ามตอบรายละเอียดสินค้าในเคสนี้',
    'ถ้าลูกค้าพิมพ์เลขตะกร้าเพื่อถามราคา/รายละเอียดชัดเจน ให้ตอบจากข้อมูลสินค้าลำดับนั้น แล้วปิดการขายแบบแม่ค้าไลฟ์',
    'ถ้าถามราคา ให้ตอบราคาจากข้อมูลเท่านั้น แล้วปิดท้ายด้วยการสั่งซื้อ ไม่ใช้คำว่าลองดู',
    'ถ้าถามว่า “ใช้ดีไหม”, “ดีไหม”, “น่าใช้ไหม” ให้ตอบมั่นใจแบบแม่ค้าไลฟ์ว่าดีจริง งานดี ใช้แล้วสวย/คุ้ม/ขายดี แล้วปิดให้กดสั่งซื้อ',
    'ถ้าถามเรื่องคุมมัน ให้ตอบมั่นใจว่าเอาอยู่ คุมมันดี หน้าไม่เยิ้ม งานผิวสวย แล้วปิดการขาย ถ้าสินค้านั้นเป็นแป้ง/คุชชั่น',
    'ถ้าลูกค้าถามเรื่องสีผิว/เฉดแป้ง/คุชชั่น/เบอร์ และคำที่พิมพ์ยังจับสินค้าไม่ได้ ให้ถามกลับแบบคนจริงก่อนว่าหมายถึงตัวไหนหรือตะกร้าไหน ห้ามเดาสินค้าเองจากหลายตะกร้า',
    'ถ้าลูกค้าถามเรื่องสีผิว/เฉดแป้ง/คุชชั่นพร้อมเลขตะกร้า เช่น “ตะกร้า 9 ผิวสองสีใช้เบอร์ไหน” ต้องตอบเสมอ ห้ามเงียบ ถ้าข้อมูลสินค้าไม่มี mapping เฉด ให้ใช้คำแนะนำทั่วไปของเมคอัพ: 01 ผิวขาวหรืออมชมพู, 02 ผิวขาวเหลือง/ผิวสองสีอ่อน, 03 ผิวสองสี/ผิวน้ำผึ้ง, 04 ผิวเข้ม แล้วบอกให้ลูกค้าเลือกตามโทนผิว',
    'ถ้าถามผิวสองสีพร้อมเลขตะกร้า ให้แนะนำ 02 ถ้าอยากสว่างธรรมชาติ หรือ 03 ถ้าอยากกลืนผิว/ไม่ลอย แล้วปิดการขายด้วยคำหลากหลายแบบคนขาย โดยใส่เลขตะกร้านั้น',
    'ถ้าลูกค้าถามเฉดลิป ให้ตอบโทนสีแบบเข้าใจง่าย เช่น 01 ชมพู/นู้ดสุภาพ, 02 แดงหรือแดงก่ำ, 03 ส้ม/พีช, 04 ตุ่น/น้ำตาล แล้วบอกให้เลือกตามลุค ถ้าข้อมูลจริงมีชื่อสีให้ยึดข้อมูลจริงก่อน',
    'ถ้าสินค้ามีหลายแบบในตะกร้าเดียว ให้บอกตัวเลือก/เบอร์ที่เหมาะแบบสั้น ๆ ไม่ต้องบอกว่าไม่ทราบ',
    'ถ้ามีตัวเลือกสินค้า เช่น สี/แบบ/เบอร์ ให้บอกลูกค้าแบบสั้น ๆ หรือถามว่าจะรับแบบไหน พร้อมชวนกดสั่ง',
    'ถ้าคอมเมนต์ถามสินค้าที่ระบุไม่ชัด ให้ถามกลับให้ลูกค้าบอกชื่อสินค้า/เลขลำดับ/สี/ไซซ์ที่ต้องการแบบคนคุยจริง',
    'ถ้าสินค้าหมด ให้แจ้งแบบนุ่มนวลและชวนดูตัวอื่นในตะกร้า',
    'ห้ามใส่อีโมจิเกิน 1 ตัว และไม่ต้องใส่ทุกครั้ง',
  ].join('\n');

  const payload = await callOpenAi(apiKey, {
      model,
      input: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            channelName: input.channelName,
            customerName: input.customerName,
            comment: input.comment,
            productCount: products.length,
            products: productContext,
            basketLinks: links.slice(0, 10),
          }),
        },
      ],
      temperature: 0.55,
      max_output_tokens: 160,
  });

  const reply = extractOutputText(payload);
  if (!reply) throw new AppError('OpenAI ไม่ได้ส่งข้อความตอบกลับมา', 502);

  return {
    reply,
    model,
    productsTotal: products.length,
    matchedProducts: matchedProducts.map(compactProduct),
  };
}
