const fs = require("fs");
const path = require("path");

const ID_OVERRIDES = {
  "Nelson Mandela": "mandela",
  "Mark Twain": "twain",
  "Walt Disney": "disney",
  "Sheryl Sandberg": "sandberg",
  "Wayne Gretzky": "gretzky",
  "Billie Jean King": "king",
  "Warren Buffett": "buffett",
  "Aristotle": "aristotle",
};

const groups = {
  leader: [
    "Nelson Mandela", "Mahatma Gandhi", "Martin Luther King Jr.", "Abraham Lincoln", "Winston Churchill",
    "Barack Obama", "Michelle Obama", "Joe Biden", "Donald Trump", "Kamala Harris", "Hillary Clinton",
    "Angela Merkel", "Jacinda Ardern", "Margaret Thatcher", "Golda Meir", "Indira Gandhi", "Queen Elizabeth II",
    "King Charles III", "Lee Kuan Yew", "Lee Hsien Loong", "Lawrence Wong", "Narendra Modi", "Atal Bihari Vajpayee",
    "Jawaharlal Nehru", "Sardar Vallabhbhai Patel", "Subhas Chandra Bose", "APJ Abdul Kalam", "Manmohan Singh",
    "A.P.J. Abdul Kalam", "Pratibha Patil", "Droupadi Murmu", "Draupadi Murmu", "Emmanuel Macron", "Olaf Scholz",
    "Ursula von der Leyen", "Christine Lagarde", "António Guterres", "Kofi Annan", "Ban Ki-moon", "Malala Yousafzai",
    "Wangari Maathai", "Ellen Johnson Sirleaf", "Desmond Tutu", "Cyril Ramaphosa", "Paul Kagame", "Aliko Dangote",
    "Volodymyr Zelenskyy", "Justin Trudeau", "Rishi Sunak", "Keir Starmer", "Giorgia Meloni", "Pedro Sánchez",
    "Mark Rutte", "Donald Tusk", "Andrzej Duda", "Luiz Inácio Lula da Silva", "Jair Bolsonaro", "Gabriel Boric",
    "Javier Milei", "Claudia Sheinbaum", "Andrés Manuel López Obrador", "Justin Welby", "Pope Francis",
    "Xi Jinping", "Shinzo Abe", "Fumio Kishida", "Yoon Suk Yeol", "Park Geun-hye", "Tsai Ing-wen",
    "Joko Widodo", "Prabowo Subianto", "Anwar Ibrahim", "Mahathir Mohamad", "Ferdinand Marcos Jr.",
    "Sheikh Hasina", "Imran Khan", "Benazir Bhutto", "Muhammad Ali Jinnah", "Shehbaz Sharif",
    "Benjamin Netanyahu", "Yitzhak Rabin", "Shimon Peres", "King Abdullah II", "Mohammed bin Salman",
    "Recep Tayyip Erdoğan", "Mustafa Kemal Atatürk", "Abdel Fattah el-Sisi", "Nelson Rolihlahla Mandela",
    "Frédéric Passy", "Eleanor Roosevelt", "Franklin D. Roosevelt", "Theodore Roosevelt", "John F. Kennedy",
    "Lyndon B. Johnson", "Ronald Reagan", "George H. W. Bush", "George W. Bush", "Bill Clinton",
    "Jimmy Carter", "Dwight D. Eisenhower", "Harry S. Truman", "Woodrow Wilson", "Thomas Jefferson",
    "George Washington", "Benjamin Franklin", "Frederick Douglass", "Harriet Tubman", "Sojourner Truth",
    "Rosa Parks", "Cesar Chavez", "Rigoberta Menchú", "Aung San Suu Kyi", "Daw Aung San Suu Kyi",
    "Vaclav Havel", "Lech Wałęsa", "Mikhail Gorbachev", "Helmut Kohl", "Willy Brandt", "Konrad Adenauer",
    "Charles de Gaulle", "François Mitterrand", "Jacques Chirac", "Nicolas Sarkozy", "François Hollande",
    "Tony Blair", "Gordon Brown", "David Cameron", "Theresa May", "Boris Johnson", "Liz Truss",
    "Pierre Trudeau", "Lester B. Pearson", "Nelson Mandela Foundation", "Haile Selassie", "Kwame Nkrumah",
    "Jomo Kenyatta", "Julius Nyerere", "Thomas Sankara", "Patrice Lumumba", "Sam Nujoma", "Robert Mugabe",
    "Olusegun Obasanjo", "Goodluck Jonathan", "Muhammadu Buhari", "Bola Tinubu", "Nana Akufo-Addo",
    "Abiy Ahmed", "William Ruto", "Uhuru Kenyatta", "Raila Odinga", "Hakainde Hichilema",
    "Emmerson Mnangagwa", "F. W. de Klerk", "Thabo Mbeki", "Kgalema Motlanthe", "Jacob Zuma",
  ],
  business: [
    "Elon Musk", "Mukesh Ambani", "Gautam Adani", "Ratan Tata", "N. R. Narayana Murthy", "Nandan Nilekani",
    "Azim Premji", "Shiv Nadar", "Anand Mahindra", "Kumar Mangalam Birla", "Lakshmi Mittal", "Uday Kotak",
    "Radhakishan Damani", "Kiran Mazumdar-Shaw", "Falguni Nayar", "Harsh Mariwala", "Sunil Mittal",
    "Sachin Bansal", "Binny Bansal", "Vijay Shekhar Sharma", "Bhavish Aggarwal", "Nithin Kamath",
    "Deepinder Goyal", "Kunal Shah", "Peyush Bansal", "Girish Mathrubootham", "Byju Raveendran",
    "Sriharsha Majety", "Albinder Dhindsa", "Ritesh Agarwal", "Kunal Bahl", "Rohit Bansal", "Sameer Nigam",
    "Jeff Bezos", "Bill Gates", "Warren Buffett", "Mark Zuckerberg", "Larry Page", "Sergey Brin",
    "Steve Jobs", "Steve Wozniak", "Tim Cook", "Satya Nadella", "Sundar Pichai", "Jensen Huang", "Lisa Su",
    "Reed Hastings", "Marc Benioff", "Safra Catz", "Sheryl Sandberg", "Indra Nooyi", "Ginni Rometty",
    "Mary Barra", "Adena Friedman", "Jane Fraser", "Rosalind Brewer", "Abigail Johnson", "Ruth Porat",
    "Susan Wojcicki", "Marissa Mayer", "Meg Whitman", "Carly Fiorina", "Ursula Burns", "Anne Mulcahy",
    "Sara Blakely", "Tory Burch", "Oprah Winfrey", "Rihanna", "Kylie Jenner", "Kim Kardashian",
    "Gary Vaynerchuk", "Naval Ravikant", "Paul Graham", "Sam Altman", "Patrick Collison", "John Collison",
    "Brian Chesky", "Joe Gebbia", "Drew Houston", "Stewart Butterfield", "Tobias Lütke", "Daniel Ek",
    "Evan Spiegel", "Jack Dorsey", "Biz Stone", "Jan Koum", "Brian Acton", "Dara Khosrowshahi",
    "Travis Kalanick", "Tony Xu", "Howard Schultz", "Ray Kroc", "Walt Disney", "Bob Iger", "Ted Sarandos",
    "Shantanu Narayen", "Arvind Krishna", "Nikesh Arora", "Michael Dell", "Larry Ellison", "Marc Andreessen",
    "Ben Horowitz", "Peter Thiel", "Reid Hoffman", "Eric Schmidt", "Andy Jassy", "Adam Neumann",
    "Whitney Wolfe Herd", "Melanie Perkins", "Anne Wojcicki", "Katrina Lake", "Jennifer Hyman",
    "Payal Kadakia", "Reshma Saujani", "Arianna Huffington", "Martha Stewart", "Richard Branson",
    "James Dyson", "Alan Sugar", "Deborah Meaden", "Ingvar Kamprad", "Stefan Persson", "Bernard Arnault",
    "François-Henri Pinault", "Amancio Ortega", "Giorgio Armani", "Miuccia Prada", "Donatella Versace",
    "Ralph Lauren", "Phil Knight", "Estée Lauder", "Leonard Lauder", "Kevin Plank", "Yvon Chouinard",
    "Hamdi Ulukaya", "Michael Bloomberg", "Ray Dalio", "Jamie Dimon", "Larry Fink", "Charlie Munger",
    "Peter Lynch", "John Bogle", "Benjamin Graham", "Cathie Wood", "Ken Griffin", "Stephen Schwarzman",
    "Henry Kravis", "George Soros", "Carl Icahn", "Masayoshi Son", "Akio Morita", "Soichiro Honda",
    "Konosuke Matsushita", "Tadashi Yanai", "Akio Toyoda", "Hiroshi Mikitani", "Jack Ma", "Pony Ma",
    "Robin Li", "Ren Zhengfei", "Lei Jun", "Zhang Yiming", "Colin Huang", "Wang Xing", "Richard Liu",
    "Robin Zeng", "Wang Chuanfu", "Zhong Shanshan", "Aliko Dangote", "Patrice Motsepe", "Strive Masiyiwa",
    "Tony Elumelu", "Johann Rupert", "Nicky Oppenheimer", "Carlos Slim", "Jorge Paulo Lemann",
    "David Vélez", "Marcos Galperin", "Tope Awotona", "Iyinoluwa Aboyeji", "Odunayo Eweniyi",
    "Mo Ibrahim", "Isabel dos Santos", "Folorunsho Alakija", "Ndidi Nwuneli", "Rebecca Enonchong",
    "Vusi Thembekwayo", "Patrice Tlhopane Motsepe", "Elon R. Musk", "Jensen Huang Nvidia",
  ],
  sport: [
    "Virat Kohli", "Sachin Tendulkar", "MS Dhoni", "Rohit Sharma", "Jasprit Bumrah", "Ravindra Jadeja",
    "Kapil Dev", "Sunil Gavaskar", "Rahul Dravid", "Sourav Ganguly", "Anil Kumble", "VVS Laxman",
    "Yuvraj Singh", "Virender Sehwag", "Harbhajan Singh", "Zaheer Khan", "Mithali Raj", "Jhulan Goswami",
    "Smriti Mandhana", "Harmanpreet Kaur", "Shafali Verma", "Rishabh Pant", "Shubman Gill", "Hardik Pandya",
    "Ravichandran Ashwin", "Mohammed Shami", "KL Rahul", "Suryakumar Yadav", "Jasprit Bumrah India",
    "Babar Azam", "Shaheen Shah Afridi", "Wasim Akram", "Waqar Younis", "Javed Miandad", "Kumar Sangakkara",
    "Mahela Jayawardene", "Sanath Jayasuriya", "Muttiah Muralitharan", "Lasith Malinga", "Steve Smith",
    "Pat Cummins", "Mitchell Starc", "David Warner", "Ricky Ponting", "Shane Warne", "Glenn McGrath",
    "Adam Gilchrist", "Steve Waugh", "Don Bradman", "Kane Williamson", "Trent Boult", "Brendon McCullum",
    "Ben Stokes", "Joe Root", "James Anderson", "Stuart Broad", "Alastair Cook", "Kevin Pietersen",
    "Jonny Bairstow", "Eoin Morgan", "Jos Buttler", "Chris Gayle", "Brian Lara", "Viv Richards",
    "Clive Lloyd", "Garfield Sobers", "Shivnarine Chanderpaul", "Andre Russell", "Dwayne Bravo",
    "AB de Villiers", "Hashim Amla", "Dale Steyn", "Kagiso Rabada", "Faf du Plessis", "Jacques Kallis",
    "Shaun Pollock", "Graeme Smith", "Quinton de Kock", "Lionel Messi", "Cristiano Ronaldo", "Pelé",
    "Diego Maradona", "Zinedine Zidane", "Ronaldinho", "Ronaldo Nazário", "Kaká", "Andrés Iniesta",
    "Xavi Hernández", "Luka Modrić", "Toni Kroos", "Manuel Neuer", "Robert Lewandowski", "Erling Haaland",
    "Kylian Mbappé", "Neymar", "Vinícius Júnior", "Karim Benzema", "Mohamed Salah", "Sadio Mané",
    "Virgil van Dijk", "Kevin De Bruyne", "Thierry Henry", "Johan Cruyff", "Marco van Basten",
    "Paolo Maldini", "Franco Baresi", "Francesco Totti", "Gianluigi Buffon", "Andrea Pirlo",
    "Zlatan Ibrahimović", "Wayne Rooney", "David Beckham", "Steven Gerrard", "Frank Lampard",
    "Bobby Charlton", "George Best", "Didier Drogba", "Samuel Eto'o", "George Weah", "Sunil Chhetri",
    "Marta", "Alex Morgan", "Megan Rapinoe", "Sam Kerr", "Ada Hegerberg", "Michael Jordan", "LeBron James",
    "Kobe Bryant", "Stephen Curry", "Kevin Durant", "Magic Johnson", "Larry Bird", "Tim Duncan",
    "Shaquille O'Neal", "Kareem Abdul-Jabbar", "Giannis Antetokounmpo", "Nikola Jokić", "Luka Dončić",
    "Diana Taurasi", "Sue Bird", "Maya Moore", "Breanna Stewart", "A'ja Wilson", "Roger Federer",
    "Rafael Nadal", "Novak Djokovic", "Serena Williams", "Venus Williams", "Steffi Graf",
    "Martina Navratilova", "Billie Jean King", "Pete Sampras", "Andre Agassi", "Björn Borg",
    "John McEnroe", "Andy Murray", "Carlos Alcaraz", "Jannik Sinner", "Iga Świątek", "Naomi Osaka",
    "Ashleigh Barty", "Maria Sharapova", "Sania Mirza", "Leander Paes", "Usain Bolt", "Carl Lewis",
    "Jesse Owens", "Allyson Felix", "Shelly-Ann Fraser-Pryce", "Eliud Kipchoge", "Haile Gebrselassie",
    "Mo Farah", "Milkha Singh", "PT Usha", "Hima Das", "Neeraj Chopra", "Abhinav Bindra", "Mary Kom",
    "PV Sindhu", "Saina Nehwal", "Michael Phelps", "Katie Ledecky", "Simone Biles", "Nadia Comăneci",
    "Tiger Woods", "Rory McIlroy", "Jack Nicklaus", "Annika Sörenstam", "Lewis Hamilton", "Max Verstappen",
    "Michael Schumacher", "Ayrton Senna", "Sebastian Vettel", "Muhammad Ali", "Mike Tyson",
    "Floyd Mayweather", "Manny Pacquiao", "Canelo Álvarez", "Sugar Ray Leonard", "Joe Frazier",
    "Khabib Nurmagomedov", "Anderson Silva", "Georges St-Pierre", "Amanda Nunes", "Ronda Rousey",
    "Wayne Gretzky", "Sidney Crosby", "Connor McDavid", "Alex Ovechkin", "Mario Lemieux", "Bobby Orr",
    "Hayley Wickenheiser", "Sachin Ramesh Tendulkar", "Viswanathan Anand", "Magnus Carlsen",
    "Garry Kasparov", "Judit Polgár", "Koneru Humpy", "Sunil Narine", "Jasprit Jasveer Bumrah",
  ],
  science: [
    "Albert Einstein", "Marie Curie", "Isaac Newton", "Charles Darwin", "Nikola Tesla", "Thomas Edison",
    "Ada Lovelace", "Alan Turing", "Grace Hopper", "Katherine Johnson", "Rosalind Franklin", "Jane Goodall",
    "Richard Feynman", "Stephen Hawking", "Carl Sagan", "Neil deGrasse Tyson", "C. V. Raman", "Homi J. Bhabha",
    "Satyendra Nath Bose", "Srinivasa Ramanujan", "Jagadish Chandra Bose", "Venki Ramakrishnan",
    "Har Gobind Khorana", "Subrahmanyan Chandrasekhar", "Amartya Sen", "Abhijit Banerjee", "Esther Duflo",
    "Raghuram Rajan", "Gita Gopinath", "Janet Yellen", "Ben Bernanke", "Elinor Ostrom", "Muhammad Yunus",
    "Tu Youyou", "Jennifer Doudna", "Emmanuelle Charpentier", "Katalin Karikó", "Frances Arnold",
    "Donna Strickland", "Tim Berners-Lee", "Vint Cerf", "Margaret Hamilton", "Radia Perlman", "Fei-Fei Li",
    "Yann LeCun", "Geoffrey Hinton", "Yoshua Bengio", "Andrew Ng", "Demis Hassabis", "Ilya Sutskever",
    "Dario Amodei", "Mira Murati", "Galileo Galilei", "Johannes Kepler", "Nicolaus Copernicus",
    "Louis Pasteur", "Alexander Fleming", "Jonas Salk", "Florence Nightingale", "Elizabeth Blackwell",
    "Barbara McClintock", "Rita Levi-Montalcini", "Dorothy Hodgkin", "Lise Meitner", "Chien-Shiung Wu",
    "Hideki Yukawa", "Abdus Salam", "Ahmed Zewail", "May-Britt Moser", "Carol W. Greider",
    "Elizabeth Blackburn", "Shinya Yamanaka", "Yoshinori Ohsumi", "Jennifer A. Doudna",
  ],
  letters: [
    "Aristotle", "Plato", "Socrates", "Marcus Aurelius", "Seneca", "Epictetus", "Confucius", "Laozi",
    "Rumi", "Khalil Gibran", "Mark Twain", "Maya Angelou", "Toni Morrison", "Chimamanda Ngozi Adichie",
    "Arundhati Roy", "Jhumpa Lahiri", "Salman Rushdie", "Vikram Seth", "R. K. Narayan", "Rabindranath Tagore",
    "Munshi Premchand", "Amrita Pritam", "Haruki Murakami", "Gabriel García Márquez", "Isabel Allende",
    "Pablo Neruda", "Octavio Paz", "Jorge Luis Borges", "Virginia Woolf", "Jane Austen", "George Orwell",
    "James Baldwin", "Langston Hughes", "Audre Lorde", "bell hooks", "Brené Brown", "Yuval Noah Harari",
    "Malcolm Gladwell", "Angela Duckworth", "Carol Dweck", "Stephen Covey", "Dale Carnegie", "Napoleon Hill",
    "James Clear", "Ryan Holiday", "Cal Newport", "Atomic Habits James Clear", "Paulo Coelho",
    "Khaled Hosseini", "Elif Shafak", "Orhan Pamuk", "Mo Yan", "Lu Xun", "Ban Ki Moon Writer",
  ],
  culture: [
    "Oprah Winfrey", "Beyoncé", "Taylor Swift", "Adele", "Billie Eilish", "A. R. Rahman", "Lata Mangeshkar",
    "Asha Bhosle", "Kishore Kumar", "Mohammed Rafi", "Sonu Nigam", "Arijit Singh", "Shreya Ghoshal",
    "Jay-Z", "Kendrick Lamar", "Drake", "Rihanna", "Shakira", "Madonna", "Freddie Mercury",
    "Michael Jackson", "Prince", "Bob Marley", "Bob Dylan", "Aretha Franklin", "Whitney Houston",
    "Stevie Wonder", "Yo-Yo Ma", "Zakir Hussain", "Ravi Shankar", "M. S. Subbulakshmi", "Bhimsen Joshi",
    "Ilaiyaraaja", "Shah Rukh Khan", "Amitabh Bachchan", "Rajinikanth", "Kamal Haasan", "Mohanlal",
    "Mammootty", "Prabhas", "Allu Arjun", "Yash", "Deepika Padukone", "Priyanka Chopra", "Alia Bhatt",
    "Sridevi", "Madhuri Dixit", "Satyajit Ray", "S. S. Rajamouli", "Mani Ratnam", "Sanjay Leela Bhansali",
    "Zoya Akhtar", "Mira Nair", "Steven Spielberg", "Martin Scorsese", "Christopher Nolan", "Greta Gerwig",
    "Hayao Miyazaki", "Bong Joon-ho", "Akira Kurosawa", "Spike Lee", "Jordan Peele", "Ryan Coogler",
    "Chloé Zhao", "Alfonso Cuarón", "Guillermo del Toro", "Denis Villeneuve", "Dwayne Johnson",
    "Tom Cruise", "Leonardo DiCaprio", "Meryl Streep", "Viola Davis", "Denzel Washington",
    "Morgan Freeman", "Will Smith", "Keanu Reeves", "Zendaya", "MrBeast", "Marques Brownlee",
    "Casey Neistat", "Emma Chamberlain", "Khaby Lame", "Mark Rober", "Ali Abdaal", "Lilly Singh",
    "Prajakta Koli", "Bhuvan Bam", "Ashish Chanchlani", "CarryMinati", "Tanmay Bhat", "Zakir Khan",
    "Vir Das", "Kapil Sharma", "Trevor Noah", "Hasan Minhaj", "Grete Thunberg", "Greta Thunberg",
    "Malala Yousafzai", "Simone Biles Culture", "RM of BTS", "Jung Kook", "Jennie Kim", "Lisa Manobal",
    "IU", "BTS RM", "PewDiePie", "Yes Theory", "Derek Muller", "Michael Stevens", "Simone Giertz",
  ],
};

const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const BLOCK = new Set([
  "nelson mandela foundation",
  "a.p.j. abdul kalam",
  "draupadi murmu",
  "daw aung san suu kyi",
  "nelson rolihlahla mandela",
  "elon r. musk",
  "jensen huang nvidia",
  "jasprit bumrah india",
  "jasprit jasveer bumrah",
  "sachin ramesh tendulkar",
  "atomic habits james clear",
  "ban ki moon writer",
  "jennifer a. doudna",
  "simone biles culture",
  "bts rm",
  "grete thunberg",
  "patrice tlhopane motsepe",
]);

const seenNames = new Set();
const seenIds = new Set();
const idols = [];

Object.entries(groups).forEach(([group, names]) => {
  names.forEach((name) => {
    const key = name.trim().toLowerCase();
    if (!key || seenNames.has(key) || BLOCK.has(key)) return;
    let id = ID_OVERRIDES[name.trim()] || slug(name);
    if (!id || seenIds.has(id)) return;
    seenNames.add(key);
    seenIds.add(id);
    idols.push({ id, name: name.trim(), group });
  });
});

if (idols.length < 508) {
  console.error("Only", idols.length, "unique idols");
  process.exit(1);
}

const required = ["Virat Kohli", "Elon Musk", "Mukesh Ambani", "Nelson Mandela", "Warren Buffett"];
required.forEach((name) => {
  if (!idols.some((item) => item.name === name)) {
    console.error("Missing", name);
    process.exit(1);
  }
});

const payload = JSON.stringify(idols, null, 2);
const targets = [
  path.join(__dirname, "../data/idols.json"),
  path.join(__dirname, "../../Dood/src/data/idols.json"),
];
targets.forEach((file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, payload);
});
console.log("wrote", idols.length);
