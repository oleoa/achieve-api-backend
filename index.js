// EMAIL AND SERVER
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
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
      //console.log(reservation);

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
        a3: "500",
        b1: "Spacestar",
        c1: "Clio",
        c2: "Sandero",
      };

      let cadeiras = 0;
      let assentos = 0;
      if (reservation.optionals.extras)
        reservation.optionals.extras.forEach((extra) => {
          if (extra.code == "cadeira") cadeiras = extra.quantity;
          if (extra.code == "assento") assentos = extra.quantity;
        });

      let locale = reservation.customer.country;
      let name = toTitleCase(reservation.customer.name);

      let prepareDate = new Date(reservation.pickup_date);
      prepareDate.setHours(prepareDate.getHours() - 1);

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
                  text: { content: "#" + reservation.booking_nr },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Preparação" },
            },
            Grupo: {
              type: "select",
              select: { name: vehicleTranslator[reservation.group] },
            },
            Data: {
              type: "date",
              date: {
                start: prepareDate.toISOString(),
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
                reservation.booking_nr,
            },
            Cadeiras: {
              type: "number",
              number: cadeiras,
            },
            Assentos: {
              type: "number",
              number: assentos,
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
                  text: { content: "#" + reservation.booking_nr },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Entrega" },
            },
            Grupo: {
              type: "select",
              select: { name: vehicleTranslator[reservation.group] },
            },
            Data: {
              type: "date",
              date: {
                start: new Date(reservation.pickup_date).toISOString(),
                time_zone: "Atlantic/Madeira",
              },
            },
            Local: {
              type: "select",
              select: { name: localTranslator[reservation.pickup_station] },
            },
            Anyrent: {
              type: "url",
              url:
                "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
                reservation.booking_nr,
            },
            Whatsapp: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: reservation.customer.phone } },
              ],
            },
            Voo: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: reservation.arrival_flight } },
              ],
            },
            Cadeiras: {
              type: "number",
              number: cadeiras,
            },
            Assentos: {
              type: "number",
              number: assentos,
            },
            País: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: locale } }],
            },
            Cliente: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: name } }],
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
                  text: { content: "#" + reservation.booking_nr },
                },
              ],
            },
            Operação: {
              type: "select",
              select: { name: "Recolha" },
            },
            Grupo: {
              type: "select",
              select: { name: vehicleTranslator[reservation.group] },
            },
            Data: {
              type: "date",
              date: {
                start: new Date(reservation.dropoff_date).toISOString(),
                time_zone: "Atlantic/Madeira",
              },
            },
            Local: {
              type: "select",
              select: { name: localTranslator[reservation.dropoff_station] },
            },
            Anyrent: {
              type: "url",
              url:
                "https://achieverac.s12.anyrent.pt/app/jedeye/anyrent/reservations/update/" +
                reservation.booking_nr,
            },
            Whatsapp: {
              type: "rich_text",
              rich_text: [
                { type: "text", text: { content: reservation.customer.phone } },
              ],
            },
            Voo: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: { content: reservation.departure_flight },
                },
              ],
            },
            Cadeiras: {
              type: "number",
              number: cadeiras,
            },
            Assentos: {
              type: "number",
              number: assentos,
            },
            País: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: locale } }],
            },
            Cliente: {
              type: "rich_text",
              rich_text: [{ type: "text", text: { content: name } }],
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
