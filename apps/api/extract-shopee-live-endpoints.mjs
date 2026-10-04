const urls = [
  'https://live.shopee.co.th/multipages/_next/static/chunks/pages/share-b697ea55ca81331ecdd9.js',
  'https://live.shopee.co.th/multipages/_next/static/chunks/7b32c417496b31784c58688d9ffddf81042e19f2.f7d7b160dabbf917c035.js',
  'https://live.shopee.co.th/multipages/_next/static/chunks/91.de7e82e84f2e7ac61d77.js',
];

function compact(text) {
  return String(text || '').replace(/\s+/g, ' ');
}

function sample(text, index) {
  return compact(text.slice(Math.max(0, index - 900), index + 1600));
}

function unique(values) {
  return [...new Set(values)].filter(Boolean);
}

async function main() {
  const report = [];
  for (const url of urls) {
    const response = await fetch(url);
    const text = await response.text();
    const endpoints = unique(
      [...text.matchAll(/(?:"|')([^"']*(?:\/api\/v\d|\/webapi\/v\d|chatroom-live|message|comment|chatroom|send)[^"']*)(?:"|')/gi)]
        .map((match) => match[1])
        .filter((value) => !/^[a-z0-9_./-]{1,3}$/i.test(value))
        .filter((value) => !/^(comment|message|send|chatroom|content)$/i.test(value)),
    );
    const strong = [];
    for (const needle of [
      '/message',
      '/comment',
      'sendMessage',
      'send_message',
      'post_comment',
      'postComment',
      'usersig',
      'user_sig',
      'chatroomId',
      'chatroom_id',
      'Content-Type',
      'X-Livestreaming-Source',
    ]) {
      let index = text.indexOf(needle);
      let guard = 0;
      while (index >= 0 && guard < 12) {
        strong.push({ needle, index, sample: sample(text, index) });
        index = text.indexOf(needle, index + needle.length);
        guard += 1;
      }
    }
    report.push({ url, length: text.length, endpoints: endpoints.slice(0, 200), strong: strong.slice(0, 80) });
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
