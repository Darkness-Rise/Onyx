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
        .setDescription('El mercado negro y contrabando del distrito en Fallen Ash Realm.')
        
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
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- SEGURIDAD PARA AGREGAR ---
        if (subcommand === 'agregar' && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '*Te bloquea el paso con el brazo.* Solo los capos de la organización deciden qué entra al mostrador.',
                ephemeral: true
            });
        }

        try {
            // ==========================================
            // --- SUBCOMANDO: VER Y COMPRAR (INTERACTIVO) ---
            // ==========================================
            if (subcommand === 'ver') {
                await interaction.deferReply();

                // Obtenemos solo los objetos con stock disponible
                const items = await ItemTienda.find({ guildId, stock: { $gt: 0 } });

                if (items.length === 0) {
                    return await interaction.editReply({
                        content: '*El mostrador está completamente vacío.* No hay contrabando disponible en el distrito en este momento.'
                    });
                }

                const porPagina = 5; // Máximo 5 elementos por página (límite recomendado para menús desplegables de Discord de 25 opciones, dejando margen)
                const totalPaginas = Math.ceil(items.length / porPagina);
                let paginaActual = 0;

                // Función para construir el Embed de la página actual
                const generarEmbedTienda = (pagina) => {
                    const inicio = pagina * porPagina;
                    const fin = inicio + porPagina;
                    const itemsPagina = items.slice(inicio, fin);

                    const embed = new EmbedBuilder()
                        .setTitle('🛒 Mercado Negro — Contrabando FAR')
                        .setColor('#2b2b2b')
                        .setDescription(`Selecciona un artículo en el menú de abajo para adquirirlo al instante.\n*Página ${pagina + 1} de ${totalPaginas}*`)
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

                // Función para construir el menú desplegable de selección de compra de la página actual
                const generarMenuSeleccion = (pagina) => {
                    const inicio = pagina * porPagina;
                    const itemsPagina = items.slice(inicio, inicio + porPagina);

                    const opciones = itemsPagina.map(item => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(item.nombre.substring(0, 100)) // Discord exige máximo 100 caracteres en el label
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

                // Función para construir los botones de navegación (páginas)
                const generarBotonesNavegacion = (pagina) => {
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
                            .setDisabled(pagina === totalPaginas - 1)
                    );
                };

                // Componentes iniciales
                const components = [generarMenuSeleccion(paginaActual)];
                if (totalPaginas > 1) {
                    components.push(generarBotonesNavegacion(paginaActual));
                }

                const mensaje = await interaction.editReply({
                    embeds: [generarEmbedTienda(paginaActual)],
                    components: components
                });

                // Colector de interacciones para botones y menú (expira en 2 minutos)
                const collector = mensaje.createMessageComponentCollector({ time: 120000 });

                collector.on('collect', async i => {
                    // --- CASO 1: CAMBIO DE PÁGINA (BOTONES) ---
                    if (i.isButton()) {
                        if (i.user.id !== interaction.user.id) {
                            return await i.reply({ content: '⚠️ No metas las manos en el mostrador ajeno.', ephemeral: true });
                        }

                        if (i.customId === 'tienda_prev' && paginaActual > 0) paginaActual--;
                        else if (i.customId === 'tienda_next' && paginaActual < totalPaginas - 1) paginaActual++;

                        const newComponents = [generarMenuSeleccion(paginaActual)];
                        if (totalPaginas > 1) {
                            newComponents.push(generarBotonesNavegacion(paginaActual));
                        }

                        await i.update({
                            embeds: [generarEmbedTienda(paginaActual)],
                            components: newComponents
                        });
                    }

                    // --- CASO 2: COMPRA DE ARTÍCULO (MENÚ DESPLEGABLE) ---
                    else if (i.isStringSelectMenu()) {
                        if (i.customId === 'comprar_select_item') {
                            await i.deferReply({ ephemeral: true });
                            
                            const itemId = i.values[0];
                            const userId = i.user.id;

                            // Buscamos el objeto fresco en la base de datos
                            const item = await ItemTienda.findById(itemId);

                            if (!item || item.stock <= 0) {
                                return await i.editReply({ content: '⚠️ Lo siento, este artículo ya se agotó o fue retirado del mostrador.' });
                            }

                            // Verificamos saldo del comprador
                            const cuentaUsuario = await obtenerBalance(userId, guildId);

                            if (cuentaUsuario.dinero < item.precio) {
                                return await i.editReply({
                                    content: `*Te revisas los bolsillos y niegas con la cabeza.* No te alcanza el efectivo. Cuesta **${item.precio.toLocaleString()} €** y solo tienes **${cuentaUsuario.dinero.toLocaleString()} €** en mano.`
                                });
                            }

                            // Descontamos Euros y guardamos
                            cuentaUsuario.dinero -= item.precio;
                            await cuentaUsuario.save();

                            // Reducimos el stock (1 unidad)
                            item.stock -= 1;
                            if (item.stock <= 0) {
                                await ItemTienda.deleteOne({ _id: item._id });
                            } else {
                                await item.save();
                            }

                            // Otorgar rol de Discord si está vinculado
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

                            // Actualizamos el mensaje principal de la tienda para reflejar el nuevo stock en tiempo real
                            const itemsActualizados = await ItemTienda.find({ guildId, stock: { $gt: 0 } });
                            if (itemsActualizados.length === 0) {
                                await mensaje.edit({
                                    content: '*El mostrador se ha quedado completamente vacío.* No queda más contrabando.',
                                    embeds: [],
                                    components: []
                                }).catch(() => {});
                            } else {
                                // Ajustamos la página si nos pasamos del límite tras la compra
                                const nuevoTotalPaginas = Math.ceil(itemsActualizados.length / porPagina);
                                if (paginaActual >= nuevoTotalPaginas) paginaActual = nuevoTotalPaginas - 1;

                                // Refrescamos la vista de la tienda principal
                                // (Nota: Para simplificar la recarga global del embed aquí, actualizamos con los datos nuevos)
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

        } catch (error) {
            console.error('Error en el comando tienda:', error);
            const errorMsg = { content: '⚠️ *El mostrador cruje y se traba.* Ocurrió un error procesando el mercado negro.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(errorMsg).catch(() => {});
            else await interaction.reply(errorMsg).catch(() => {});
        }
    },
};
