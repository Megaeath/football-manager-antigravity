## Plan: Legend Mode Team Checklist

[x] D1-13 Manchester City  

### Steps
1. Lock canonical teams from [src/lib/data/teams.ts](src/lib/data/teams.ts) (`createTeamsData()` output).
2. Use logical team keys `D#-##` because DB `id` is generated in [prisma/schema.prisma](prisma/schema.prisma).
3. Create one-team-per-request CSV with required fields and uniqueness checks.
4. Mark completed teams in the checklist immediately after each delivered CSV.
5. Enforce cross-team uniqueness via a shared “used legends” registry per session.
6. Reconcile seed divergence against [prisma/seed.js](prisma/seed.js) only when needed.

### Team Checklist (60 teams)

#### Phase 1 (D1-01 → D1-10)
[x] D1-01 Arsenal  
[x] D1-02 Aston Villa  
[x] D1-15 Newcastle United  
[x] D1-04 Brentford  
[x] D1-05 Brighton  
[x] D1-06 Chelsea  
[x] D1-07 Crystal Palace  
[x] D1-12 Liverpool  
[x] D1-08 Everton  
[x] D1-09 Fulham  
[x] D1-10 Ipswich Town  


#### Phase 2 (D1-11 → D1-20)
[*] D3-01 Real Sociedad  
[ ] D1-12 Liverpool  
[ ] D1-13 Manchester City  
[ ] D1-14 Manchester United  
[ ] D1-15 Newcastle United  
[ ] D1-16 Nottingham Forest  
[x] D1-17 Southampton  
[x] D1-18 Tottenham Hotspur  
[x] D1-19 West Ham United  
[x] D1-20 Wolves  

#### Phase 3 (D2-01 → D2-10)
[x] D2-01 Leeds United  
[x] D2-02 Sunderland  
[x] D2-03 Burnley  
Tom Heaton
[ ] Legends used:
Claudio Bravo
Asier Riesgo
Inigo Martinez
Alberto de la Bella
Carlos Martinez
Joseba Zaldua
Asier Illarramendi
Xabi Prieto
David Zurutuza
Sergio Canales
Antoine Griezmann
Carlos Vela
Imanol Agirretxe
Willian Jose
Adnan Januzaj
Nicky Pope
Michael Duff
Ben Mee
James Tarkowski
Kieran Trippier
Stephen Ward
Joey Barton
Jack Cork
Dean Marney
Robbie Blake
Scott Arfield
Chris Eagles
Jay Rodriguez
Ashley Barnes
[x] D2-04 Sheffield United  
Simon Moore
Dean Henderson
Chris Basham
John Egan
Jack O'Connell
Enda Stevens
George Baldock
Oliver Norwood
John Fleck
Paul Coutts
Billy Sharp
David McGoldrick
Lys Mousset
Mark Duffy
John Lundstram
[x] D2-05 Middlesbrough  
Mark Schwarzer
Brad Jones
Gareth Southgate
Chris Riggott
Franck Queudrue
Luke Young
George Boateng
Gaizka Mendieta
Fabio Rochemback
Juninho Paulista
Boudewijn Zenden
Stewart Downing
Jimmy Floyd Hasselbaink
Mark Viduka
Yakubu
[x] D2-06 West Bromwich Albion  
Boaz Myhill
Ben Foster
Gareth McAuley
Jonas Olsson
Chris Brunt
Billy Jones
Claudio Yacob
James Morrison
Paul Scharner
Matt Phillips
Peter Odemwingie
Hal Robson-Kanu
[x] D2-07 Norwich City  
Angus Gunn
John Ruddy
Grant Hanley
Christoph Zimmermann
Max Aarons
Jamal Lewis
Alexander Tettey
Jonny Howson
Emiliano Buendia
Todd Cantwell
Wes Hoolahan
Onel Hernandez
Teemu Pukki
Grant Holt
Cameron Jerome
[x] D2-08 Watford  
Heurelho Gomes
Adrian Mariappa
Craig Cathcart
Jose Holebas
Kiko Femenia
Etienne Capoue
Abdoulaye Doucoure
Will Hughes
Roberto Pereyra
Ismaila Sarr
Troy Deeney
Odion Ighalo
Andre Gray
Gerard Deulofeu
[x] D2-09 Coventry City  
Steve Ogrizovic
Chris Kirkland
Richard Shaw
Mo Konjic
David Burrows
Roland Nilsson
Gary McAllister
Mustapha Hadji
Youssef Chippo
Darren Huckerby
Peter Ndlovu
Noel Whelan
Dion Dublin
Robbie Keane
John Hartson
[x] D2-10 Stoke City  
Asmir Begovic
Thomas Sorensen
Ryan Shawcross
Robert Huth
Erik Pieters
Andy Wilkinson
Glenn Whelan
Steven Nzonzi
Charlie Adam
Matthew Etherington
Jon Walters
Peter Crouch
Kenwyne Jones
Ricardo Fuller
Mame Biram Diouf

#### Phase 4 (D2-11 → D2-20)
[x] D2-11 Derby County  
Stephen Bywater
Mart Poom
Michael Johnson
Igor Stimac
Chris Powell
Paul Green
Seth Johnson
Robbie Savage
Jeff Kenna
Tommy Smith
Marco Gabbiadini
Dean Sturridge
Malcolm Christie
Paulo Wanchope
Darren Bent
[x] D2-12 Blackburn Rovers  
Brad Friedel
Tim Flowers
Colin Hendry
Ryan Nelsen
Graeme Le Saux
Michel Salgado
David Batty
Tim Sherwood
Jason Wilcox
Stuart Ripley
Chris Sutton
Alan Shearer
Matt Jansen
Benni McCarthy
Roque Santa Cruz
[*] D2-13 Portsmouth  
David James
Shaka Hislop
Linvoy Primus
Arjan de Zeeuw
Dejan Stefanovic
Glen Johnson
Matthew Taylor
Gary O'Neil
Pedro Mendes
Niko Kranjcar
Paul Merson
Lomana LuaLua
Benjani Mwaruwari
Teddy Sheringham
Yakubu
[x] D2-14 Hull City  
Boaz Myhill
Allan McGregor
Andy Dawson
Michael Dawson
Alex Bruce
Paul McShane
Andy Robertson
Tom Huddlestone
David Meyler
Robert Koren
George Boyd
Ahmed Elmohamady
Abel Hernandez
Dean Windass
Nick Barmby
[x] D2-15 Swansea City  
Lukasz Fabianski
Michel Vorm
Ashley Williams
Angel Rangel
Ben Davies
Chico Flores
Leon Britton
Ki Sung-yueng
Jonathan de Guzman
Gylfi Sigurdsson
Nathan Dyer
Wayne Routledge
Wilfried Bony
Michu
Danny Graham
[x] D2-16 Real Madrid  
Iker Casillas
Keylor Navas
Sergio Ramos
Roberto Carlos
Marcelo
Fernando Hierro
Pepe
Michel Salgado
Luka Modric
Toni Kroos
Zinedine Zidane
David Beckham
Cristiano Ronaldo
Raul
Ronaldo Nazario
[x] D2-17 Barcelona  
Victor Valdes
Marc-Andre ter Stegen
Carles Puyol
Gerard Pique
Eric Abidal
Dani Alves
Jordi Alba
Sergio Busquets
Xavi
Andres Iniesta
Deco
Samuel Eto'o
David Villa
Luis Suarez
Lionel Messi
[x] D2-18 Atletico Madrid  
Jan Oblak
Thibaut Courtois
Diego Godin
Juanfran
Filipe Luis
Miranda
Gabi
Koke
Saul Niguez
Tiago Mendes
Arda Turan
Antoine Griezmann
Diego Costa
Fernando Torres
Radamel Falcao
[x] D2-19 Girona  
Iraizoz
Bono
Bernardo Espinosa
Juanpe
Marc Muniesa
Pablo Maffeo
Alex Granell
Pere Pons
Borja Garcia
Portu
Cristhian Stuani
Christian Rivera
Pedro Alcala
Anthony Lozano
Seydou Doumbia
[x] D2-20 Athletic Bilbao  
Gorka Iraizoz
Kepa Arrizabalaga
Andoni Iraola
Mikel San Jose
Aymeric Laporte
Mikel Balenziaga
Oscar de Marcos
Ander Iturraspe
Beñat Etxebarria
Markel Susaeta
Iker Muniain
Aritz Aduriz
Inaki Williams
Raul Garcia
Gaizka Toquero

#### Phase 5 (D3-01 → D3-10)
[x] D3-01 Real Sociedad  
Claudio Bravo
Asier Riesgo
Inigo Martinez
Alberto de la Bella
Carlos Martinez
Joseba Zaldua
Asier Illarramendi
Xabi Prieto
David Zurutuza
Sergio Canales
Antoine Griezmann
Carlos Vela
Imanol Agirretxe
Willian Jose
Adnan Januzaj
[x] D3-02 Real Betis  
Antonio Prats
Pedro Contreras
Juanito
David Rivas
Melli
Fernando Varela
Marcos Assuncao
Arzu
Joaquin
Capi
Denilson
Ruben Castro
Ricardo Oliveira
Achille Emana
Alfonso Perez
[x] D3-03 Sevilla  
[x] D3-04 Valencia  
[x] D3-05 Villarreal  
[x] D3-06 Bayern Munich  
[x] D3-07 Bayer Leverkusen  
[x] D3-08 Borussia Dortmund  
[x] D3-09 RB Leipzig  
[x] D3-10 VfB Stuttgart  

#### Phase 6 (D3-11 → D3-20)
[x] D3-11 Paris Saint-Germain  
[x] D3-12 Monaco  
Jean-Luc Ettori
Flavio Roma
Patrice Evra
Franck Dumas
Rafael Márquez
Eric Abidal
Manuel Amoros
Claude Puel
Lucas Bernardi
Youri Djorkaeff
Ludovic Giuly
Jerome Rothen
David Trezeguet
Sonny Anderson
Radamel Falcao
[x] D3-13 Lille  
Grégory Wimbée
Mickaël Landreau
Franck Béria
Adil Rami
José Fonte
Mathieu Debuchy
Idrissa Gueye
Florent Balmont
Yohan Cabaye
Eden Hazard
Mathieu Bodmer
Gervinho
Nicolas Pépé
Luis Araujo
Loïc Rémy
[x] D3-14 Marseille  
Fabien Barthez
Steve Mandanda
Basile Boli
Marcel Desailly
Eric Di Meco
Manuel Amoros
Didier Deschamps
Jean Tigana
Abedi Pelé
Chris Waddle
Franck Sauzée
Jean-Pierre Papin
Didier Drogba
André-Pierre Gignac
Loïc Rémy
[x] D3-15 Lyon  
Grégory Coupet
Hugo Lloris
Cris
Eric Abidal
Anthony Réveillère
Edmilson
Juninho Pernambucano
Tiago Mendes
Michael Essien
Florent Malouda
Sidney Govou
Karim Benzema
Sony Anderson
Alexandre Lacazette
Claudio Caçapa
[x] D3-16 Inter Milan  
Walter Zenga
Samir Handanovic
Giuseppe Bergomi
Lucio
Javier Zanetti
Marco Materazzi
Esteban Cambiasso
Dejan Stankovic
Wesley Sneijder
Diego Milito
Mauro Icardi
Samuel Eto'o
Alvaro Recoba
Roberto Baggio
Christian Vieri
[x] D3-17 AC Milan  
Sebastiano Rossi
Dida
Franco Baresi
Paolo Maldini
Alessandro Nesta
Billy Costacurta
Mauro Tassotti
Demetrio Albertini
Frank Rijkaard
Andrea Pirlo
Clarence Seedorf
Kaká
Andriy Shevchenko
Filippo Inzaghi
George Weah
[x] D3-18 Juventus  
Gianluigi Buffon
Angelo Peruzzi
Gaetano Scirea
Claudio Gentile
Antonio Cabrini
Lilian Thuram
Paolo Montero
Andrea Pirlo
Didier Deschamps
Pavel Nedved
Michel Platini
Alessandro Del Piero
David Trezeguet
Roberto Baggio
Zinedine Zidane
[x] D3-19 Napoli  
Dino Zoff
Morgan De Sanctis
Giuseppe Bruscolotti
Salvatore Bagni
Francesco Romano
Ciro Ferrara
Paolo Cannavaro
Giovanni Francini
Fabio Cannavaro
Marek Hamsik
Diego Maradona
Dries Mertens
Ezequiel Lavezzi
Edinson Cavani
Gonzalo Higuain
[*] D3-20 AS Roma  
Francesco Totti
Daniele De Rossi
Bruno Conti
Giuseppe Giannini
Aldair
Cafu
Vincenzo Montella
Roberto Pruzzo
Paulo Roberto Falcao
Agostino Di Bartolomei
Emerson
Antonio Carlos Zago
Philippe Mexes
Marco Delvecchio
Morgan De Sanctis

### Further Considerations
Bernard Lama
Salvatore Sirigu
Thiago Silva
Marquinhos
Maxwell
Serge Aurier
Marco Verratti
Blaise Matuidi
Angel Di Maria
David Beckham
Nene
Zlatan Ibrahimovic
Edinson Cavani
Kylian Mbappe
Neymar
Timo Hildebrand
Serdar Tasci
Matthieu Delpierre
Andreas Beck
Arthur Boka
Thomas Hitzlsperger
Sami Khedira
Roberto Hilbert
Christian Gentner
Alex Hleb
Cacau
Mario Gomez
Kevin Kuranyi
Daniel Ginczek
Peter Gulacsi
Yvon Mvogo
Willi Orban
Dayot Upamecano
Marcel Halstenberg
Lukas Klostermann
Kevin Kampl
Diego Demme
Emil Forsberg
Marcel Sabitzer
Christopher Nkunku
Timo Werner
Yussuf Poulsen
Jean-Kevin Augustin
Roman Weidenfeller
Mats Hummels
Neven Subotic
Lukasz Piszczek
Marcel Schmelzer
Ilkay Gundogan
Sven Bender
Shinji Kagawa
Jakub Blaszczykowski
Marco Reus
Pierre-Emerick Aubameyang
Jan Koller
Alexander Frei
Rene Adler
Bernd Leno
Carsten Ramelow
Lucio
Gonzalo Castro
Diego Placente
Simon Rolfes
Bernd Schneider
Ze Roberto
Michael Ballack
Paul Freier
Dimitar Berbatov
Stefan Kiessling
Ulf Kirsten
Patrick Helmes
Manuel Neuer
Oliver Kahn
Philipp Lahm
David Alaba
Jerome Boateng
Lucio
Bastian Schweinsteiger
Xabi Alonso
Franck Ribery
Arjen Robben
Thomas Muller
Robert Lewandowski
Mario Gomez
Giovane Elber
Claudio Pizarro
Sergio Asenjo
Mariano Barbosa
Diego Godin
Gonzalo Rodriguez
Jaume Costa
Mario Gaspar
Bruno Soriano
Manu Trigueros
Santi Cazorla
Marcos Senna
Cani
Joan Capdevila
Giuseppe Rossi
Diego Forlan
Nilmar
Santiago Canizares
Roberto Ayala
Miguel
Amedeo Carboni
David Albelda
Ruben Baraja
Pablo Aimar
Vicente
Francisco Rufete
David Villa
Juan Sanchez
Mista
John Carew
Claudio Lopez
Andres Palop
Beto
Javi Navarro
Julien Escude
Daniel Alves
Antonio Puerta
Adriano
Renato
Enzo Maresca
Jesus Navas
Jose Antonio Reyes
Frederic Kanoute
Luis Fabiano
Kevin Gameiro
Alvaro Negredo
1. Confirm whether CSV should store logical key (`D#-##`) plus team name, or runtime-resolved DB `id`.
2. Confirm “position max 2 players” rule means max 2 per role group (GK/DC/MC/FW).
3. Draft for review: approve this order, then start with D1-01 Arsenal.

David Seaman
Jens Lehmann
Lee Dixon
Lauren
Tony Adams
Sol Campbell
Martin Keown
Kolo Toure
Nigel Winterburn
Ashley Cole
Patrick Vieira
Gilberto Silva
Liam Brady
Cesc Fabregas
Dennis Bergkamp
Mesut Ozil
Freddie Ljungberg
Bukayo Saka
Robert Pires
Alexis Sanchez
Thierry Henry
Ian Wright
Nigel Spink
Olof Mellberg
Paul McGrath
Martin Laursen
Charlie Aitken
Lee Hendrie
Gareth Barry
Dennis Mortimer
Jack Grealish
Peter Withe
Gabriel Agbonlahor
Aaron Ramsdale
Simon Francis
Steve Cook
Nathan Ake
Charlie Daniels
Marc Pugh
Jefferson Lerma
Lewis Cook
Harry Arter
Callum Wilson
Ted MacDougall
David Raya
Dan Bentley
Rico Henry
Pontus Jansson
Ethan Pinnock
Henrik Dalsgaard
Christian Norgaard
Josh Dasilva
Bryan Mbeumo
Said Benrahma
Ivan Toney
Mathew Ryan
Robert Sanchez
Bruno Saltor
Lewis Dunk
Ben White
Dan Burn
Pascal Gross
Alexis Mac Allister
Solly March
Kaoru Mitoma
Glenn Murray
Petr Cech
Ed de Goey
Cesar Azpilicueta
John Terry
Marcel Desailly
Ashley Cole  # ⚠️ Already used for Arsenal
Claude Makelele
Frank Lampard
Michael Essien
Eden Hazard
Arjen Robben
Didier Drogba
Gianfranco Zola
Julián Speroni
Vicente Guaita
Aaron Wan-Bissaka
Scott Dann
Damien Delaney
Joel Ward
Luka Milivojevic

Gary Mabbutt
Ledley King
Pat Jennings
Hugo Lloris
Danny Blanchflower
Steve Perryman
Jan Vertonghen
Glenn Hoddle
Paul Gascoigne
David Ginola
Chris Waddle
Jimmy Greaves
Harry Kane
Clive Allen
Robbie Keane
Geoff Thomas
Wilfried Zaha
Andros Townsend
Andrew Johnson
Neville Southall
Jordan Pickford
Seamus Coleman
Phil Jagielka
David Unsworth
Leighton Baines
Idrissa Gueye
Tim Cahill
Leon Osman
Andrei Kanchelskis
Steven Pienaar
Romelu Lukaku
Duncan Ferguson
Antti Niemi
Paul Jones
Francis Benali
Jason Dodd
Klaus Lundekvam
Jose Fonte
Wayne Bridge
Matt Le Tissier
James Ward-Prowse
David Armstrong
Adam Lallana
Marian Pahars
Rickie Lambert
James Beattie
Kevin Davies
Lee Hendrie
Gareth Barry
Dennis Mortimer
Jack Grealish
Peter Withe
Gabriel Agbonlahor
Aaron Ramsdale
Simon Francis
Steve Cook
Nathan Ake
Charlie Daniels
Marc Pugh
Jefferson Lerma
Lewis Cook
Harry Arter
Callum Wilson
Ted MacDougall
David Raya
Dan Bentley
Rico Henry
Pontus Jansson
Ethan Pinnock
Henrik Dalsgaard
Christian Norgaard
Josh Dasilva
Bryan Mbeumo
Said Benrahma
Ivan Toney
Mathew Ryan
Robert Sanchez
Bruno Saltor
Lewis Dunk
Ben White
Dan Burn
Pascal Gross
Alexis Mac Allister
Solly March
Kaoru Mitoma
Glenn Murray
Petr Cech
Ed de Goey
Kasper Schmeichel
Gary Mills
Joe Hart
Pablo Zabaleta
Vincent Kompany
Richard Dunne
Gael Clichy
Yaya Toure
Colin Bell
David Silva
Kevin De Bruyne
Riyad Mahrez
Sergio Aguero
Carlos Tevez
Steve Walsh
Matt Elliott
Christian Fuchs
Wilfred Ndidi
Neil Lennon
Danny Drinkwater
Riyad Mahrez
Steve Guppy
Jamie Vardy
Ray Clemence
Phil Neal
Alan Hansen
Virgil van Dijk
Alan Kennedy
Graeme Souness
Steven Gerrard
Kenny Dalglish
John Barnes
Ian Rush
Robbie Fowler
Mohamed Salah
Gary Lineker
Cesar Azpilicueta
John Terry
Marcel Desailly
Shay Given
Warren Barton
Philippe Albert
Jonathan Woodgate
John Beresford
Rob Lee
Gary Speed
David Ginola
Nolberto Solano
Peter Beardsley
Alan Shearer
Les Ferdinand
Ashley Cole  # ⚠️ Already used for Arsenal
Claude Makelele
Frank Lampard
Michael Essien
Eden Hazard
Arjen Robben
Didier Drogba
Gianfranco Zola
Julián Speroni
Vicente Guaita
Aaron Wan-Bissaka
Scott Dann
Damien Delaney
Joel Ward
Luka Milivojevic
Geoff Thomas
Wilfried Zaha
Andros Townsend
Andrew Johnson
Neville Southall
Jordan Pickford
Seamus Coleman
Phil Jagielka
David Unsworth
Leighton Baines
Idrissa Gueye
Tim Cahill
Peter Schmeichel
Gary Neville
Steve Bruce
Jaap Stam
Dennis Irwin
Roy Keane
Paul Scholes
Ryan Giggs
David Beckham
Eric Cantona
Wayne Rooney
Ruud van Nistelrooy
Leon Osman
Andrei Kanchelskis
Steven Pienaar
Romelu Lukaku
Duncan Ferguson
Mark Schwarzer
Steve Finnan
Brede Hangeland
Aaron Hughes
Moritz Volz
Danny Murphy
Sean Davis
Steed Malbranque
Luis Boa Morte
Clint Dempsey
Bobby Zamora
Brian McBride
Paul Cooper
George Burley
Terry Butcher
Russell Osman
Mick Mills
Arnold Muhren
Frans Thijssen
Eric Gates
John Wark
Clive Woods
Paul Mariner
Alan Brazil
Peter Shilton
Viv Anderson
Des Walker
Kenny Burns
Stuart Pearce
John McGovern
Steve Hodge
John Robertson
Ian Bowyer
Trevor Francis
Tony Woodcock
Stan Collymore
Ludek Miklosko
Rui Patricio
John Ruddy
Matt Doherty
Andy Thompson
Conor Coady
Willy Boly
George Elokobi
Ruben Neves
Joao Moutinho
David Edwards
Matt Jarvis
Diogo Jota
Raul Jimenez
Steve Bull
John Richards
Nigel Martyn
John Lukic
Gary Kelly
Tony Dorigo
Lucas Radebe
Norman Hunter
Jonathan Woodgate
Gordon Strachan
Gary McAllister
David Batty
Lee Bowyer
Harry Kewell
Allan Clarke
Mark Viduka
Jermaine Beckford
Thomas Sorensen
Jim Montgomery
Chris Makin
Michael Gray
Charlie Hurley
Jody Craddock
Kevin Ball
Lee Cattermole
Don Hutchison
Stefan Schwarz
Kevin Kilbane
Julio Arca
Niall Quinn
Kevin Phillips
Marco Gabbiadini
Phil Parkes
Julian Dicks
Ray Stewart
Alvin Martin
James Collins
Billy Bonds
Mark Noble
Martin Peters
Alan Devonshire
Paolo Di Canio
Carlton Cole
Trevor Brooking
Geoff Hurst
Tony Cottee
