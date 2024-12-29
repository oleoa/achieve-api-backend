// EMAIL AND SERVER
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Replace with your Vite app's URL
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow necessary HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  })
);
app.use(bodyParser.json());
require("dotenv").config();

// NOTION
const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// GET ANYRENT INFORMATION
const axios = require("axios");

// Transforma String em "Title Case"
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Formata a reserva para maior entendimento
function formatReservation(reservation) {
  let localTranslator = {
    aeroporto: "Aeroporto",
    funchal: "Funchal",
    "santa-cruz": "Santa Cruz",
    "porto-moniz": "Porto Moniz",
    "sao-vicente": "São Vicente",
    santana: "Santana",
    calheta: "Calheta",
    "ponta-do-sol": "Ponta do Sol",
    "ribeira-brava": "Ribeira Brava",
    "camara-de-lobos": "Câmara de Lobos",
    machico: "Machico",
    canico: "Caniço",
  };
  let vehicleTranslator = {
    a1: "Panda",
    a2: "Up",
    a3: "5null",
    b1: "Spacestar",
    c1: "Clio",
    c2: "Sandero",
  };

  const newNotionOperation = {
    id: null,
    grupo: null,
    anyrent: null,
    voo: null,
    extras: {
      cadeiras: null,
      assentos: null,
    },
    cliente: {
      nome: null,
      pais: null,
      whatsapp: null,
    },
    preparacao: {
      data: null,
    },
    entrega: {
      operacao: "Entrega",
      data: null,
      local: null,
    },
    recolha: {
      operacao: "Recolha",
      data: null,
      local: null,
    },
  };
  newNotionOperation.id = reservation.booking_nr;
  if (reservation.optionals.extras)
    reservation.optionals.extras.forEach((extra) => {
      if (extra.code == "cadeira")
        newNotionOperation.extras.cadeiras = extra.quantity;
      if (extra.code == "assento")
        newNotionOperation.extras.assentos = extra.quantity;
    });
  newNotionOperation.cliente.pais = reservation.customer.country;
  newNotionOperation.cliente.nome = toTitleCase(reservation.customer.name);
  newNotionOperation.entrega.data = new Date(
    reservation.pickup_date,
  ).toISOString();
  let lavagemData = new Date(reservation.pickup_date);
  lavagemData.setHours(lavagemData.getHours() - 1);
  lavagemData = lavagemData.toISOString();
  newNotionOperation.preparacao.data = lavagemData;
  newNotionOperation.recolha.data = new Date(
    reservation.dropoff_date,
  ).toISOString();
  newNotionOperation.entrega.local =
    localTranslator[reservation.pickup_station];
  newNotionOperation.recolha.local =
    localTranslator[reservation.dropoff_station];
  newNotionOperation.grupo = vehicleTranslator[reservation.group];
  newNotionOperation.anyrent =
    "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
    newNotionOperation.id;
  newNotionOperation.cliente.whatsapp = reservation.customer.phone.replaceAll(
    " ",
    "",
  );
  newNotionOperation.voo = reservation.departure_flight;
  return newNotionOperation;
}

// Função para atualizar as kilometragens das viaturas
async function updateVehicles() {
  let vehicles = await axios.get(
    "https://achieverac.api.anyrent.pt/v1/vehicles/?api_key=" +
      process.env.ANYRENT_API_KEY,
  );
  vehicles = vehicles.data.vehicles;
  let fleetTranslator = {
    "03-UG-18": "f78e7cd2d61143e0b8a5a2c5bec2b474",
    "85-ZQ-59": "9da37efc521448f6af679a40d047ef64",
    "AI-82-BH": "18a2b1698d984808886c310ba1e8d16e",
    "BG-03-RV": "8353d8f751cc4cfdaa579069eda2ae5e",
    "BG-16-RV": "b2e53d1114be4dc888c10f9380e5790f",
    "BG-33-RV": "18b5ac198e3543d2906ba9abc47c674d",
    "BH-06-LE": "370e2cbb64be436d9ef68621293072bb",
    "BH-11-LI": "ca33b5cc522d496ea482d98c3052017e",
    "BH-11-LL": "c185a3c01c754319ad1b28ffe21d8129",
    "BH-25-LL": "2eba66ed790647248a0a114ec14359bc",
    "BH-56-LE": "030a5dde0ad747489d33aaf8eeaff2e0",
    "BH-87-MT": "5c5d558471004306bd76ce43b0db0e7c",
    "BJ-92-JU": "bcb35d23e48d4eb2a0ee032aa7d7f5e3",
    "BJ-93-JU": "ed217ffdadbe4342b8ac5512615bd011",
    "BJ-95-JU": "bad4d2a1df4a480089d7149a5475666d",
    "BJ-97-JU": "e4a7b1d6437f448b9e2ed611df1c49fa",
    "BJ-98-JU": "b76200cfef9949d688d6c01df76a4737",
  };
  let fleet = [];
  vehicles.forEach(async (car) => {
    await notion.pages.update({
      page_id: fleetTranslator[car.license_plate],
      properties: {
        Km: {
          type: "number",
          number: parseInt(car.kms),
        },
      },
    });
  });
}

// Rota para criar uma nova reserva ( 3 operações )
app.post("/add", async (req, res) => {
  // Recebe o ID da nova reserva
  const idReserva = req.body.id;

  // Pede informações ao anyrent
  axios
    .get(
      "https://achieverac.api.anyrent.pt/v1/bookings/" +
        idReserva +
        "?api_key=" +
        process.env.ANYRENT_API_KEY,
    )
    .then((response) => {
      // Se existir, cria tres novas linhas na base de dados notion (lavagem, entrega e recolha)
      let reservation = response.data;
      let formattedBooking = formatReservation(reservation);

      (async () => {
        let preparacao = await notion.pages.create({
          parent: {
            type: "database_id",
            database_id: "7107291622514df2ac798e53e3291541",
          },
          properties: {
            "#": {
              type: "title",
              title: [
                {
                  type: "text",
                  text: { content: "#" + formattedBooking.id },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Preparação" },
            },
            Grupo: {
              type: "select",
              select: { name: formattedBooking.grupo },
            },
            Data: {
              type: "date",
              date: {
                start: formattedBooking.preparacao.data,
                time_zone: "Atlantic/Madeira",
              },
            },
            Local: {
              type: "select",
              select: { name: "Sede" },
            },
            Anyrent: {
              type: "url",
              url:
                "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
                formattedBooking.id,
            },
            Cadeiras: {
              type: "number",
              number: formattedBooking.extras.cadeiras ?? 0,
            },
            Assentos: {
              type: "number",
              number: formattedBooking.extras.assentos ?? 0,
            },
          },
        });

        let entrega = await notion.pages.create({
          parent: {
            type: "database_id",
            database_id: "7107291622514df2ac798e53e3291541",
          },
          properties: {
            "#": {
              type: "title",
              title: [
                {
                  type: "text",
                  text: { content: "#" + formattedBooking.id },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Entrega" },
            },
            Grupo: {
              type: "select",
              select: { name: formattedBooking.grupo },
            },
            Data: {
              type: "date",
              date: {
                start: formattedBooking.entrega.data,
                time_zone: "Atlantic/Madeira",
              },
            },
            Local: {
              type: "select",
              select: { name: formattedBooking.entrega.local },
            },
            Anyrent: {
              type: "url",
              url:
                "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
                formattedBooking.id,
            },
            Whatsapp: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: formattedBooking.cliente.whatsapp } },
              ],
            },
            Voo: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: formattedBooking.voo } },
              ],
            },
            Cadeiras: {
              type: "number",
              number: formattedBooking.extras.cadeiras,
            },
            Assentos: {
              type: "number",
              number: formattedBooking.extras.assentos,
            },
            País: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: formattedBooking.cliente.pais } }],
            },
            Cliente: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: formattedBooking.cliente.nome } }],
            },
          },
        });

        let recolha = await notion.pages.create({
          parent: {
            type: "database_id",
            database_id: "7107291622514df2ac798e53e3291541",
          },
          properties: {
            "#": {
              type: "title",
              title: [
                {
                  type: "text",
                  text: { content: "#" + formattedBooking.id },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Recolha" },
            },
            Grupo: {
              type: "select",
              select: { name: formattedBooking.grupo },
            },
            Data: {
              type: "date",
              date: {
                start: formattedBooking.recolha.data,
                time_zone: "Atlantic/Madeira",
              },
            },
            Local: {
              type: "select",
              select: { name: formattedBooking.recolha.local },
            },
            Anyrent: {
              type: "url",
              url:
                "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
                formattedBooking.id,
            },
            Whatsapp: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: formattedBooking.cliente.whatsapp } },
              ],
            },
            Cadeiras: {
              type: "number",
              number: formattedBooking.extras.cadeiras,
            },
            Assentos: {
              type: "number",
              number: formattedBooking.extras.assentos,
            },
            País: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: formattedBooking.cliente.pais } }],
            },
            Cliente: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: formattedBooking.cliente.nome } }],
            },
          },
        });
      })();
    })
    .catch((error) => {
      console.error("Error making GET request: ", error);
    });

  // Vai buscar pela kilometragem dos carros
  updateVehicles();

  res.status(200).send("Reserva recebida com sucesso! " + idReserva);
});

// Rota para recalcular e inserir no notion as kilometragens dos carros
app.get("/vehicles", async (req, res) => {
  // Vai buscar pela kilometragem dos carros
  updateVehicles();

  res.status(200).send("Veículos atualizados com sucesso!");
});

// Rota que verifica as reservas no anyrent a procura de uma não tratada
app.get("/verification", async (req, res) => {
  // Recebe a data de hoje em YYYYMMDD
  const today = new Date();
  const formattedPickupDate =
    today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  // Pede informações ao anyrent
  const response = await axios
    .get(
      "https://achieverac.api.anyrent.pt/v1/bookings/" +
        "?api_key=" +
        process.env.ANYRENT_API_KEY +
        "&" +
        "pickup_date_from=" +
        formattedPickupDate +
        "&" +
        "sort=pickup_date",
    )
    .catch((error) => {
      console.error("Error making GET request: ", error);
    });

  // Recebe todas as seguintes reservas
  reservations = response.data.bookings;

  // Agora verifico se alguma não tem o OK ou se alguma tem o Notion
  const filteredReservations = reservations.filter(
    (reservation) =>
      !reservation.external_reference.includes("OK") ||
      reservation.external_reference.includes("Notion"),
  );

  // Se for 0 = Não tem reservas a tratar, se for 1 = Tem reservas a tratar não para hoje, se for 2 = Tem reservas a tratar para hoje.
  let answer = [
    "Não tem reservas a tratar",
    "Tem reservas a tratar",
    "TEM RESERVAS A TRATAR PARA HOJE",
  ];

  let status;
  if (filteredReservations.length == 0) status = 0;
  else {
    let firstPickUpDate = filteredReservations[0].pickup_date.split(" ")[0];
    let todayPickUpDate = today.toISOString().split("T")[0];

    status = firstPickUpDate == todayPickUpDate ? 2 : 1;
  }

  let answerJson = {
    status: status,
    message: answer[status],
  };

  res.status(200).json(answerJson);
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
