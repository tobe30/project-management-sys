import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

//Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: "sync-user-from-clerk"},
    {event: 'clerk/user.created'},
    async ({ event})=>{
        const {data} = event;
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

// Inngest function to delete user data from the database
const syncUserDeletion = inngest.createFunction(
    {id: "delete-user-with-clerk"},
    {event: 'clerk/user.deleted'},
    async ({ event})=>{
        const {data} = event;
        await prisma.user.delete({
            where: {
                id: data.id,          
            }
        })
    }
)

// Inngest function to update user data in the database
const syncUserUpdation = inngest.createFunction(
    {id: "update-user-from-clerk"},
    {event: 'clerk/user.updated'},
    async ({ event})=>{
        const {data} = event;
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

//Inngest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
    {id: "sync-workspace-from-clerk"},
    {event: 'clerk/organization.created'},
    async ({ event})=>{
        const {data} = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        })

        // Add creator as ADMIN member: meaning
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: 'ADMIN',
            }
        })
    }
)

// Inngest function to update workspace data in the database
const syncWorkspaceUpdation = inngest.createFunction(
    {id: "update-workspace-from-clerk"},
    {event: 'clerk/organization.updated'},
    async ({event}) => {
        const {data} = event;
        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

// Inngest function to delete workspace data from the database
const syncWorkspaceDeletion = inngest.createFunction(
    {id: "delete-workspace-with-clerk"},
    {event: 'clerk/organization.deleted'},
    async ({ event})=>{
        const {data} = event;
        await prisma.workspace.delete({
            where: {
                id: data.id,          
            }
        })
    }
)

// Inngest function to save workspace member data to a database

const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: "sync-workspace-member-from-clerk"},
    {event: 'clerk/organizationInvitation.accepted'},
    async ({event}) => {
        const {data} = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)

// Inngest function to send email on Task Creation
const sendTaskAssignmentEmail = inngest.createFunction(
    {id: "send-task-assignment-email"},
    {event: 'app/task.assigned'},
    async ({event, step}) => {
        const {taskId, origin} = event.data;

        const task = await prisma.task.findUnique({
            where: {id: taskId},
            include: {assignee: true, project: true}
        })
        await sendEmail({
            to: task.assignee.email, //reciever email
            subject: `New Task Assignment in ${task.project.name}`,
            body: `Hi ${task.assignee.name}` `${task.title}`//reciever name
                     `${new Date(task.due_date).toLocaleDateString()}
                     <a href=${origin}>View Task</a>`
        })
        if(new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()){
            await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

            await step.run('check-if-task-is-completed', async() => {
                const task = await prisma.task.findUnique({
                    where: {id: taskId},
                    include: {assignee: true, project: true}
                })
                if(!task) return;

                if(task.status !== "DONE"){
                    await step.run('send-task-reminder-mail', async ()=> {
                        await sendEmail({
                            to: task.assignee.email, 
                            subject: `Reminder for ${task.project.name}`,
                            body: `Hi ${task.assignee.name}` `This is a reminder that the task "${task.title}" was due on ${new Date(task.due_date).toLocaleDateString()}.
                            <a href=${origin}>View Task</a> <p>Please complete it as soon as possible.</p>`
                        })
                    })
                }
            })
        }
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    sendTaskAssignmentEmail
];