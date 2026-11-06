const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} = require('discord.js');
const { ItemTienda, obtenerBalance } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('El mercado negro y contrabando del distrito.')
        
        // --- SUBCOMANDO 1: VER (Paginado + Menú interactivo de compra) ---
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Muestra el catálogo interactivo de contrabando y permite comprar al instante.')
        )

        // --- SUBCOMANDO 2: AGREGAR (Minimalista para Admins) ---
        .addSubcommand(subcommand =>
            subcommand
                .setName('agregar')
                .setDescription('[ADMIN] Introduce mercancía al catálogo indicando nombre, precio y cantidad (stock).')
                .addStringOption(option => 
                    option.setName('nombre')
                        .setDescription('Nombre del artículo o rol')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('precio')
                        .setDescription('Precio unitario en Euros (€)')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('cantidad')
                        .setDescription('Cantidad disponible en stock')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName('descripcion')
                        .setDescription('Detalles del producto (opcional)')
                        .setRequired(false)
                )
                .addRoleOption(option => 
                    option.setName('rol')
                        .setDescription('Rol de Discord que entrega automáticamente al adquirirlo (opcional)')
                        .setRequired(false)
                )
        )

        // --- SUBCOMANDO 3: QUITAR (ADMIN con Autocompletado) ---
        .addSubcommand(subcommand =>
            subcommand
                .setName('quitar')
                .setDescription('[ADMIN] Retira un objeto del catálogo de la tienda.')
                .addStringOption(option =>
                    option.setName('articulo')
                        .setDescription('Selecciona el artículo a retirar')
                        .setRequired(true)
                        .setAutocomplete(true) // Activamos el autocompletado en tiempo real
                )
        ),

    // Manejador del Autocompletado para el subcomando "quitar"
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        try {
            const items = await ItemTienda.find({ guildId });
            // Filtramos los elementos que coincidan con lo que el admin está escribiendo
            const filtered = items.filter(item => item.nombre.toLowerCase().includes(focusedValue.toLowerCase()));
            
            // Discord solo permite máximo 25 opciones en los resultados de autocompletado
            await interaction.respond(
                filtered.slice(0, 25).map(item => ({
                    name: `${item.nombre} (Stock: ${item.stock} | ${item.precio} €)`,
                    value: item._id.toString()
                }))
            );
        } catch (error) {
            console.error('Error en el autocompletado de la tienda:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name;

        // --- SEGURIDAD PARA ADMINS (AGREGAR Y QUITAR) ---
        if ((subcommand === 'agregar' || subcommand === 'quitar') && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '*Te bloquea el paso con el brazo.* Solo los capos de la organización deciden el inventario del mostrador.',
                ephemeral: true
            });
        }

        try {
            // ==========================================
            // --- SUBCOMANDO: VER Y COMPRAR (INTERACTIVO) ---
            // ==========================================
            if (subcommand === 'ver') {
                await interaction.deferReply();

                let items = await ItemTienda.find({ guildId, stock: { $gt: 0 } });

                if (items.length === 0) {
                    return await interaction.editReply({
                        content: '*El mostrador está completamente vacío.* No hay contrabando disponible en el distrito en este momento.'
                    });
                }

                const porPagina = 5; 
                let totalPaginas = Math.ceil(items.length / porPagina);
                let paginaActual = 0;

                const generarEmbedTienda = (pagina, listaItems) => {
                    const inicio = pagina * porPagina;
                    const fin = inicio + porPagina;
                    const itemsPagina = listaItems.slice(inicio, fin);
                    const currentTotalPaginas = Math.ceil(listaItems.length / porPagina) || 1;

                    const embed = new EmbedBuilder()
                        .setTitle(`🛒 Mercado Negro — Contrabando ${guildName}`)
                        .setColor('#2b2b2b')
                        .setDescription(`Selecciona un artículo en el menú de abajo para adquirirlo al instante.\n*Página ${pagina + 1} de ${currentTotalPaginas}*`)
                        .setTimestamp();

                    itemsPagina.forEach((item, index) => {
                        const rolTexto = item.roleId ? ` | 🎁 Rol: <@&${item.roleId}>` : '';
                        const descTexto = item.descripcion ? `\n_${item.descripcion}_` : '';
                        embed.addFields({
                            name: `📦 #${inicio + index + 1} — ${item.nombre} \`[${item.precio.toLocaleString()} €]\``,
                            value: `📌 **Stock:** \`${item.stock} disponibles\`${rolTexto}${descTexto}`
                        });
                    });

                    return embed;
                };

                const generarMenuSeleccion = (pagina, listaItems) => {
                    const inicio = pagina * porPagina;
                    const itemsPagina = listaItems.slice(inicio, inicio + porPagina);

                    const opciones = itemsPagina.map(item => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(item.nombre.substring(0, 100))
                            .setDescription(`Precio: ${item.precio.toLocaleString()} € | Stock: ${item.stock}`)
                            .setValue(item._id.toString())
                    );

                    return new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('comprar_select_item')
                            .setPlaceholder('👇 Selecciona un artículo para comprar...')
                            .addOptions(opciones)
                    );
                };

                const generarBotonesNavegacion = (pagina, listaItems) => {
                    const currentTotalPaginas = Math.ceil(listaItems.length / porPagina);
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('tienda_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pagina === 0),
                        new ButtonBuilder()
                            .setCustomId('tienda_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pagina >= currentTotalPaginas - 1)
                    );
                };

                const construirComponentes = (pagina, listaItems) => {
                    const currentTotalPaginas = Math.ceil(listaItems.length / porPagina);
                    const comps = [generarMenuSeleccion(pagina, listaItems)];
                    if (currentTotalPaginas > 1) {
                        comps.push(generarBotonesNavegacion(pagina, listaItems));
                    }
                    return comps;
                };

                const mensaje = await interaction.editReply({
                    embeds: [generarEmbedTienda(paginaActual, items)],
                    components: construirComponentes(paginaActual, items)
                });

                const collector = mensaje.createMessageComponentCollector({ time: 120000 });

                collector.on('collect', async i => {
                    if (i.isButton()) {
                        if (i.user.id !== interaction.user.id) {
                            return await i.reply({ content: '⚠️ No metas las manos en el mostrador ajeno.', ephemeral: true });
                        }

                        totalPaginas = Math.ceil(items.length / porPagina);
                        if (i.customId === 'tienda_prev' && paginaActual > 0) paginaActual--;
                        else if (i.customId === 'tienda_next' && paginaActual < totalPaginas - 1) paginaActual++;

                        await i.update({
                            embeds: [generarEmbedTienda(paginaActual, items)],
                            components: construirComponentes(paginaActual, items)
                        });
                    }
                    else if (i.isStringSelectMenu()) {
                        if (i.customId === 'comprar_select_item') {
                            await i.deferReply({ ephemeral: true });
                            
                            const itemId = i.values[0];
                            const userId = i.user.id;

                            const item = await ItemTienda.findById(itemId);

                            if (!item || item.stock <= 0) {
                                return await i.editReply({ content: '⚠️ Lo siento, este artículo ya se agotó o fue retirado del mostrador.' });
                            }

                            const cuentaUsuario = await obtenerBalance(userId, guildId);

                            if (cuentaUsuario.dinero < item.precio) {
                                return await i.editReply({
                                    content: `*Te revisas los bolsillos y niegas con la cabeza.* No te alcanza el efectivo. Cuesta **${item.precio.toLocaleString()} €** y solo tienes **${cuentaUsuario.dinero.toLocaleString()} €** en mano.`
                                });
                            }

                            cuentaUsuario.dinero -= item.precio;
                            await cuentaUsuario.save();

                            item.stock -= 1;
                            if (item.stock <= 0) {
                                await ItemTienda.deleteOne({ _id: item._id });
                            } else {
                                await item.save();
                            }

                            let mensajeRol = '';
                            if (item.roleId) {
                                try {
                                    const rolDiscord = await interaction.guild.roles.fetch(item.roleId);
                                    if (rolDiscord) {
                                        await i.member.roles.add(rolDiscord);
                                        mensajeRol = ` Además, se te ha otorgado el rango **${rolDiscord.name}** en el servidor.`;
                                    }
                                } catch (err) {
                                    console.error('Error asignando rol al comprar en tienda:', err);
                                    mensajeRol = ` *(Nota: El rol vinculado no se pudo asignar automáticamente; avisa a un superior).*`;
                                }
                            }

                            items = await ItemTienda.find({ guildId, stock: { $gt: 0 } });
                            totalPaginas = Math.ceil(items.length / porPagina);

                            if (items.length === 0) {
                                await mensaje.edit({
                                    content: '*El mostrador se ha quedado completamente vacío.* No queda más contrabando.',
                                    embeds: [],
                                    components: []
                                }).catch(() => {});
                            } else {
                                if (paginaActual >= totalPaginas) paginaActual = Math.max(0, totalPaginas - 1);
                                await mensaje.edit({
                                    embeds: [generarEmbedTienda(paginaActual, items)],
                                    components: construirComponentes(paginaActual, items)
                                }).catch(() => {});
                            }

                            return await i.editReply({
                                content: `*Desliza el artículo por debajo de la barra con una sonrisa.* Has comprado **1x ${item.nombre}** por **${item.precio.toLocaleString()} €**.${mensajeRol}`
                            });
                        }
                    }
                });

                collector.on('end', async () => {
                    await mensaje.edit({ components: [] }).catch(() => {});
                });
            }

            // ==========================================
            // --- SUBCOMANDO: AGREGAR (ADMIN) ---
            // ==========================================
            else if (subcommand === 'agregar') {
                await interaction.deferReply({ ephemeral: true });

                const nombre = interaction.options.getString('nombre');
                const precio = interaction.options.getInteger('precio');
                const cantidad = interaction.options.getInteger('cantidad');
                const descripcion = interaction.options.getString('descripcion') || 'Objeto de contrabando del distrito.';
                const rol = interaction.options.getRole('rol');

                if (precio <= 0 || cantidad <= 0) {
                    return await interaction.editReply({ content: '⚠️ El precio y la cantidad deben ser valores mayores a cero.' });
                }

                await ItemTienda.create({
                    guildId,
                    nombre,
                    descripcion,
                    precio,
                    stock: cantidad,
                    roleId: rol ? rol.id : null
                });

                await interaction.editReply({
                    content: `*Sella un nuevo contrato en el libro negro.* Se ha añadido **${nombre}** (\`${cantidad} unidades\` en stock) por **${precio.toLocaleString()} €** c/u al catálogo del bar.`
                });
            }

            // ==========================================
            // --- SUBCOMANDO: QUITAR (ADMIN) ---
            // ==========================================
            else if (subcommand === 'quitar') {
                await interaction.deferReply({ ephemeral: true });

                const itemId = interaction.options.getString('articulo');
                const itemRemovido = await ItemTienda.findByIdAndDelete(itemId);

                if (!itemRemovido || itemRemovido.guildId !== guildId) {
                    return await interaction.editReply({ content: '⚠️ No se encontró ese artículo en el inventario del servidor o ya fue eliminado.' });
                }

                await interaction.editReply({
                    content: `*Tacha furiosamente la línea en el registro.* El artículo **${itemRemovido.nombre}** ha sido retirado permanentemente del mostrador.`
                });
            }

        } catch (error) {
            console.error('Error en el comando tienda:', error);
            const errorMsg = { content: '⚠️ *El mostrador cruje y se traba.* Ocurrió un error procesando el mercado negro.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(errorMsg).catch(() => {});
            else await interaction.reply(errorMsg).catch(() => {});
        }
    },
};
